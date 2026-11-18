// Validates / normalises LLM output. Invalid questions are dropped.
function normalizeQuestions(raw, topic) {
  let list = raw;
  if (list && !Array.isArray(list) && Array.isArray(list.questions)) list = list.questions;
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const out = [];
  for (const q of list) {
    if (!q || typeof q.text !== 'string' || !q.text.trim()) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    const opts = q.options.map((o) => (typeof o === 'string' ? o.trim() : ''));
    if (opts.some((o) => !o) || new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue;
    const c = q.correctOption;
    if (!Number.isInteger(c) || c < 0 || c > 3) continue;
    const key = q.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: q.text.trim(),
      options: opts,
      correctOption: c,
      topic: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : topic,
      generatedBy: 'AI',
    });
  }
  return out;
}

// Gemini sometimes wraps JSON in ```json fences.
function parseJsonLoose(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

module.exports = { normalizeQuestions, parseJsonLoose };

// ---------------------------------------------------------------------------
// Stricter validation for Practice sections (subject + focus list + difficulty).
// Options are shuffled per attempt, so options that refer to other options
// ("All of the above", "Both A and B") would become wrong and are rejected.
// ---------------------------------------------------------------------------
const DIFFS = ['easy', 'medium', 'hard'];
const POSITIONAL = /\b(all|none|neither)\s+of\s+(the\s+)?(above|these|them)\b|\bboth\s+\(?[a-d]\)?\s+and\s+\(?[a-d]\)?\b|\b(option|choice)\s+[a-d]\b|^\(?[a-d]\)?\s*(and|&)\s*\(?[a-d]\)?$/i;

const tokens = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
function similar(a, b) {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return false;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter) >= 0.85;
}

// Map the LLM's topic label onto one of the requested focus items (case-insensitive, containment ok).
function matchFocus(label, focus) {
  const l = String(label || '').trim().toLowerCase();
  if (!l) return null;
  return focus.find((f) => f.toLowerCase() === l) || focus.find((f) => l.includes(f.toLowerCase()) || f.toLowerCase().includes(l)) || null;
}

function normalizeSectionQuestions(raw, { subject, subjectName, focus, existing = [] }) {
  let list = raw;
  if (list && !Array.isArray(list) && Array.isArray(list.questions)) list = list.questions;
  if (!Array.isArray(list)) return [];

  const kept = [];
  const texts = [...existing];
  for (const q of list) {
    if (!q || typeof q.text !== 'string' || q.text.trim().length < 8) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    const opts = q.options.map((o) => (typeof o === 'string' ? o.trim() : ''));
    if (opts.some((o) => !o || o.length > 300)) continue;
    if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue; // four distinct options
    if (opts.some((o) => POSITIONAL.test(o))) continue;
    if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption > 3) continue;
    const difficulty = String(q.difficulty || '').toLowerCase();
    if (!DIFFS.includes(difficulty)) continue;
    const topic = matchFocus(q.topic, focus);
    if (!topic) continue; // question must belong to a requested topic
    const text = q.text.trim();
    if (texts.some((t) => similar(t, text))) continue; // duplicate / near-duplicate
    texts.push(text);
    kept.push({
      text, options: opts, correctOption: q.correctOption, difficulty, topic, subject,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim().slice(0, 1200) : '',
      generatedBy: 'AI',
    });
  }
  return kept;
}

module.exports.normalizeSectionQuestions = normalizeSectionQuestions;
module.exports.matchFocus = matchFocus;
module.exports.similar = similar;
