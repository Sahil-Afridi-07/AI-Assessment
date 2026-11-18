// Pluggable LLM service. AI_PROVIDER=gemini | mock.
// AI is used ONLY for: question generation, subtopic relevance checks, and feedback/analysis text.
// Scoring never touches this module. All failures surface as AIError (never raw provider errors).
const { normalizeQuestions, normalizeSectionQuestions, parseJsonLoose } = require('./validateQuestions');
const { secondsFor, countBy } = require('./allocation');

const provider = () => (process.env.AI_PROVIDER || 'mock').toLowerCase();

class AIError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGeminiOnce(prompt, { json }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIError('AI_NOT_CONFIGURED');
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.AI_TIMEOUT_MS) || 30000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new AIError(e.name === 'AbortError' ? 'AI_TIMEOUT' : 'AI_NETWORK');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new AIError('AI_RATE_LIMIT');
  if (res.status >= 500) throw new AIError('AI_UPSTREAM');
  if (!res.ok) throw new AIError('AI_HTTP'); // never include provider body (could echo request details)
  let data;
  try { data = await res.json(); } catch { throw new AIError('AI_BAD_RESPONSE'); }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) throw new AIError('AI_EMPTY');
  return text;
}

// One retry for transient failures (rate limit, timeout, network, 5xx).
async function callGemini(prompt, opts = {}) {
  try {
    return await callGeminiOnce(prompt, opts);
  } catch (e) {
    if (['AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_NETWORK', 'AI_UPSTREAM', 'AI_EMPTY'].includes(e.code)) {
      await sleep(Number(process.env.AI_RETRY_DELAY_MS ?? 1000));
      return callGeminiOnce(prompt, opts);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Legacy single-topic generation (kept for the existing /tests/practice route and Teacher/Company preview)
// ---------------------------------------------------------------------------
function questionPrompt({ topic, difficulty, count }) {
  return `You are an exam-setter. Create exactly ${count} multiple-choice questions on "${topic}" at ${difficulty} difficulty.
Rules: each question has exactly 4 distinct options and exactly one correct option.
Return ONLY a JSON array, no prose, where each item is:
{"text": string, "options": [string, string, string, string], "correctOption": 0-3 (index of the correct option), "topic": string (a short sub-topic of "${topic}")}`;
}

function mockQuestions({ topic, difficulty, count }) {
  const stems = [
    ['Which statement best describes the core purpose of', ['Its main goal in a system', 'An unrelated hardware part', 'A marketing technique', 'A legal agreement']],
    ['Which of these is a typical use of', ['Solving problems in its own domain', 'Cooling a data centre', 'Printing invoices only', 'Replacing all databases']],
    ['A beginner should first learn which concept of', ['The fundamentals and terminology', 'Only the advanced edge cases', 'Nothing - just memorise answers', 'Unrelated syntax of another field']],
    ['Which practice is recommended when working with', ['Following established best practices', 'Ignoring documentation', 'Skipping testing entirely', 'Guessing at behaviour']],
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    const [stem, opts] = stems[i % stems.length];
    const correct = i % 4;
    const options = [...opts.slice(1)];
    options.splice(correct, 0, opts[0]);
    out.push({
      text: `[${difficulty}] Q${i + 1}. ${stem} ${topic}?`,
      options, correctOption: correct, topic: `${topic} - part ${(i % 3) + 1}`, generatedBy: 'AI',
    });
  }
  return out;
}

async function generateQuestions({ topic, difficulty = 'medium', count = 5 }) {
  count = Math.max(1, Math.min(Number(count) || 5, 20));
  if (provider() === 'mock') return mockQuestions({ topic, difficulty, count });

  let valid = [];
  for (let attempt = 0; attempt < 2 && valid.length < count; attempt++) {
    try {
      const text = await callGemini(questionPrompt({ topic, difficulty, count: count - valid.length }), { json: true });
      const more = normalizeQuestions(parseJsonLoose(text), topic);
      const have = new Set(valid.map((q) => q.text.toLowerCase()));
      for (const q of more) if (!have.has(q.text.toLowerCase())) valid.push(q);
    } catch (e) {
      if (attempt === 1 && valid.length === 0) throw e;
    }
  }
  if (valid.length === 0) throw new AIError('NO_QUESTIONS');
  return valid.slice(0, count);
}

// ---------------------------------------------------------------------------
// Practice section generation: one subject, a focus list, and a difficulty per question.
// ---------------------------------------------------------------------------
function sectionPrompt({ subjectName, focus, need, difficultyCounts }) {
  const mix = Object.entries(difficultyCounts).filter(([, n]) => n > 0).map(([d, n]) => `${n} ${d}`).join(', ');
  return `You are an expert exam-setter for "${subjectName}".
Create exactly ${need} multiple-choice questions (${mix}) covering ONLY these topics: ${focus.map((f) => `"${f}"`).join(', ')}.
Rules:
- Each question has exactly 4 distinct options and exactly ONE correct option.
- Do NOT use "All of the above", "None of the above" or options that refer to other options.
- Difficulty must really match: easy = recall/definition, medium = application, hard = multi-step reasoning or tricky edge cases.
- "topic" must be copied EXACTLY from the topic list above.
- "explanation": 1-3 sentences explaining why the correct option is right.
- No duplicate or near-duplicate questions.
Return ONLY a JSON array. Each item:
{"text": string, "options": [string, string, string, string], "correctOption": 0-3, "difficulty": "easy"|"medium"|"hard", "topic": string, "explanation": string}`;
}

function mockSection({ subjectName, focus, difficulties, startIndex = 0 }) {
  return difficulties.map((difficulty, i) => {
    const n = startIndex + i;
    const topic = focus[n % focus.length];
    const correct = n % 4;
    const right = `The standard definition of ${topic}`;
    const wrong = [`A property unrelated to ${topic}`, `Only applies outside ${subjectName}`, `A deprecated variant of ${topic}`];
    const options = [...wrong];
    options.splice(correct, 0, right);
    return {
      text: `(${subjectName}, ${difficulty}) Which option best describes ${topic}? [demo question ${n + 1}]`,
      options, correctOption: correct, difficulty, topic,
      explanation: `Demo mode: "${right}" is the intended answer. Switch AI_PROVIDER to gemini for real questions.`,
      generatedBy: 'AI',
    };
  });
}

// difficulties: array like ['easy','hard',...] (length = count). Returns exactly that many questions or throws.
async function generateSection({ subject, subjectName, focus, difficulties, avoid = [] }) {
  const count = difficulties.length;
  if (provider() === 'mock') {
    return mockSection({ subjectName, focus, difficulties }).map((q) => ({ ...q, subject }));
  }
  let have = [];
  let lastErr = null;
  for (let attempt = 0; attempt < 3 && have.length < count; attempt++) {
    const need = count - have.length;
    // Ask for the difficulties not yet covered
    const wanted = countBy(difficulties.map((d) => ({ d })), 'd');
    for (const q of have) if (wanted[q.difficulty] > 0) wanted[q.difficulty]--;
    try {
      const text = await callGemini(sectionPrompt({ subjectName, focus, need, difficultyCounts: wanted }), { json: true });
      const more = normalizeSectionQuestions(parseJsonLoose(text), {
        subject, subjectName, focus, existing: [...avoid, ...have.map((q) => q.text)],
      });
      have = have.concat(more).slice(0, count);
    } catch (e) {
      lastErr = e;
      if (e.code === 'AI_NOT_CONFIGURED') throw e;
    }
  }
  if (have.length < count) throw lastErr instanceof AIError && have.length === 0 ? lastErr : new AIError('NO_QUESTIONS');
  return have;
}

// ---------------------------------------------------------------------------
// Relevance check for custom subtopics the catalog could not decide.
// Returns { [subtopic]: boolean }. Mock mode returns null (=> caller fails closed).
// ---------------------------------------------------------------------------
async function checkRelevance(subjectName, subtopics) {
  if (provider() === 'mock') return null;
  const prompt = `Subject: "${subjectName}".
For each candidate below, decide whether it is a legitimate academic topic or concept that belongs to the subject "${subjectName}".
Answer false for anything unrelated, off-topic (sports, entertainment, weather, food, etc.), a random sentence, or a topic that belongs to a different subject.
Candidates: ${JSON.stringify(subtopics)}
Return ONLY JSON: {"results":[{"subtopic": string, "relevant": boolean}]}`;
  const parsed = parseJsonLoose(await callGemini(prompt, { json: true }));
  const out = {};
  for (const r of parsed?.results || []) if (r && typeof r.subtopic === 'string') out[r.subtopic] = r.relevant === true;
  return out;
}

// ---------------------------------------------------------------------------
// Feedback text. Built from aggregated results only - never invents data.
// ---------------------------------------------------------------------------
function ruleBasedFeedback(testTitle, percentage, breakdown) {
  const rows = [...breakdown].map((b) => ({ ...b, acc: b.total ? b.correct / b.total : 0 }));
  if (!rows.length) return `You scored ${percentage}% on "${testTitle}".`;
  rows.sort((a, b) => b.acc - a.acc);
  const strong = rows.filter((r) => r.acc >= 0.7).map((r) => r.topic);
  const weak = rows.filter((r) => r.acc < 0.5).map((r) => r.topic);
  let s = `You scored ${percentage}% on "${testTitle}". `;
  s += strong.length ? `Strong areas: ${strong.join(', ')}. ` : 'No topic reached 70% yet. ';
  s += weak.length ? `Focus your revision on: ${weak.join(', ')}.` : 'No major weak areas - try a harder difficulty next.';
  return s;
}

async function generateFeedback({ testTitle, percentage, topicBreakdown }) {
  const fallback = ruleBasedFeedback(testTitle, percentage, topicBreakdown);
  if (provider() === 'mock') return fallback;
  try {
    const lines = topicBreakdown.map((t) => `- ${t.topic}: ${t.correct}/${t.total}`).join('\n');
    const prompt = `A student scored ${percentage}% on a test titled "${testTitle}". Topic-wise results:\n${lines}\nWrite 3-4 sentences of encouraging, specific feedback: name strengths, name weak topics, and suggest what to study next. Use ONLY the data above. Plain text, no markdown.`;
    return (await callGemini(prompt)).trim() || fallback;
  } catch {
    return fallback; // never fail a submission because feedback failed
  }
}

// Cross-attempt performance analysis. `topics` = [{topic, correct, total, accuracy}]
function ruleBasedAnalysis({ attempts, questions, overallAccuracy, topics }) {
  const rated = topics.filter((t) => t.total >= 2);
  if (!rated.length) return `Based on ${attempts} assessment(s) and ${questions} question(s) so far, there is not yet enough data per topic for a detailed analysis. Complete a few more practice tests.`;
  const sorted = [...rated].sort((a, b) => b.accuracy - a.accuracy);
  const strong = sorted.filter((t) => t.accuracy >= 70).slice(0, 3).map((t) => t.topic);
  const weak = [...sorted].reverse().filter((t) => t.accuracy < 60).slice(0, 3).map((t) => t.topic);
  let s = `Across ${attempts} assessment(s) (${questions} questions) your overall accuracy is ${overallAccuracy}%. `;
  s += strong.length ? `You are performing well in ${strong.join(', ')}. ` : 'No topic has reached 70% accuracy yet. ';
  s += weak.length ? `Your weakest areas are ${weak.join(', ')}; we recommend practicing these next.` : 'No topic is below 60%, so try harder difficulty levels to keep improving.';
  return s;
}

async function generatePerformanceAnalysis(stats) {
  const fallback = ruleBasedAnalysis(stats);
  if (provider() === 'mock') return { text: fallback, source: 'rules' };
  try {
    const lines = stats.topics.map((t) => `- ${t.topic}: ${t.correct}/${t.total} correct (${t.accuracy}%)`).join('\n');
    const prompt = `You are a study coach. Below is a student's REAL aggregated assessment data (${stats.attempts} assessments, ${stats.questions} questions, overall accuracy ${stats.overallAccuracy}%).
${lines}
Write a short analysis (4-6 sentences): what they understand well, which topics need improvement, and which specific concepts to practice next.
Use ONLY the data above; do not invent scores, topics or events. Plain text, no markdown.`;
    const text = (await callGemini(prompt)).trim();
    return text ? { text, source: 'ai' } : { text: fallback, source: 'rules' };
  } catch {
    return { text: fallback, source: 'rules' };
  }
}

module.exports = {
  AIError, generateQuestions, generateSection, checkRelevance, generateFeedback, generatePerformanceAnalysis,
  ruleBasedFeedback, ruleBasedAnalysis, mockQuestions, secondsFor,
};
