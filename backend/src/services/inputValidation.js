// Layered validation of the Practice request.
//   Layer 2 (backend structure): validateRequest
//   Layer 3 (catalog match):     localRelevance
//   Layer 4 (AI relevance):      injected `aiCheck`, only for subtopics the catalog cannot decide
// The AI is never the only gatekeeper, and it fails CLOSED (unknown => rejected).
const { catalog } = require('./catalog');
const { DIFFICULTIES, MAX_QUESTIONS } = require('./allocation');
const msg = require('./messages');

const OFFTOPIC = new Set(('cricket football soccer bollywood hollywood movie movies film films song songs music weather recipe recipes cooking ' +
  'food celebrity celebrities politics election elections fashion gossip ipl news travel joke jokes dating horoscope astrology lottery ' +
  'tiktok instagram netflix anime gaming memes meme tennis hockey basketball badminton kabaddi cricketer actor actress').split(' '));

// lowercase, keep letters/digits and + # * / ., light plural stemming
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#*/.\s-]/g, ' ')
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

const phraseIn = (haystack, needle) => haystack && needle && ` ${haystack} `.includes(` ${needle} `);

function matchesSubject(text, subject) {
  const t = norm(text);
  if (!t) return false;
  const terms = [subject.name, ...subject.keywords, ...subject.topics.flatMap((tp) => [tp.name, ...tp.keywords])];
  return terms.some((term) => {
    const k = norm(term);
    // text contains the term, or (for longer inputs) the term contains the whole text
    return phraseIn(t, k) || (t.length >= 4 && phraseIn(k, t));
  });
}

// Split on commas / newlines / semicolons / bullets; dedupe; limit.
function parseSubtopics(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/[\n,;]+/);
  const seen = new Set();
  const out = [];
  for (let s of raw) {
    s = String(s ?? '').replace(/^[\s\-*•\d.)]+/, '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const looksLikeText = (s) => s.length >= 2 && s.length <= 60 && /[a-z]/i.test(s);

// Returns { valid, reason, source }. `aiCheck(subjectName, [subtopic]) -> Promise<Map|Object>` is optional.
function localRelevance(subjectId, subtopic) {
  const subject = catalog.byId[subjectId];
  if (!subject) return { valid: false, reason: 'unknown subject', source: 'local' };
  const n = norm(subtopic);
  if (n.split(' ').some((w) => OFFTOPIC.has(w))) return { valid: false, reason: 'off-topic word', source: 'blocklist' };
  if (matchesSubject(subtopic, subject)) return { valid: true, source: 'catalog' };
  // Belongs clearly to a different subject -> reject (e.g. "Normalization" under Python)
  const other = catalog.subjects.find((s) => s.id !== subjectId && matchesSubject(subtopic, s));
  if (other) return { valid: false, reason: `belongs to ${other.name}`, source: 'other-subject' };
  return { valid: null, source: 'unknown' }; // needs AI
}

async function checkSubtopics(subjectId, subtopics, aiCheck) {
  const rejected = [];
  const unknown = [];
  for (const s of subtopics) {
    const r = localRelevance(subjectId, s);
    if (r.valid === false) rejected.push({ subtopic: s, reason: r.reason });
    else if (r.valid === null) unknown.push(s);
  }
  if (!rejected.length && unknown.length) {
    let verdicts = null;
    if (aiCheck) {
      try { verdicts = await aiCheck(catalog.byId[subjectId].name, unknown); } catch { verdicts = null; }
    }
    // Fail closed: no AI verdict (or mock mode) => unknown subtopics are rejected.
    for (const s of unknown) if (!(verdicts && verdicts[s] === true)) rejected.push({ subtopic: s, reason: 'not recognised' });
  }
  return rejected;
}

// Structural validation. Returns { ok, error:{field,code,message}, value }.
function validateRequest(body) {
  const fail = (field, code, message) => ({ ok: false, error: { field, code, message } });
  const b = body || {};

  const subjects = Array.isArray(b.subjects) ? [...new Set(b.subjects.map(String))] : [];
  if (!subjects.length) return fail('subjects', 'NO_SUBJECT', msg.NO_SUBJECT);
  if (subjects.length > 6) return fail('subjects', 'TOO_MANY_SUBJECTS', 'Please select at most 6 subjects.');
  if (subjects.some((id) => !catalog.byId[id])) return fail('subjects', 'BAD_SUBJECT', msg.BAD_CUSTOM);

  const topics = {};
  const custom = {};
  for (const id of subjects) {
    const valid = new Set(catalog.byId[id].topics.map((t) => t.name));
    const picked = Array.isArray(b.topics?.[id]) ? [...new Set(b.topics[id].map(String))] : [];
    if (picked.some((t) => !valid.has(t))) return fail('topics', 'BAD_TOPIC', msg.BAD_CUSTOM);
    topics[id] = picked;

    const raw = b.customSubtopics?.[id];
    if (raw !== undefined && typeof raw !== 'string' && !Array.isArray(raw)) return fail('customSubtopics', 'BAD_CUSTOM', msg.BAD_CUSTOM);
    const subs = parseSubtopics(raw);
    if (subs.length > 10) return fail('customSubtopics', 'BAD_CUSTOM', 'Please enter at most 10 custom subtopics per subject.');
    if (subs.some((s) => !looksLikeText(s))) return fail('customSubtopics', 'BAD_CUSTOM', msg.BAD_CUSTOM);
    custom[id] = subs;

    if (!topics[id].length && !custom[id].length) return fail('topics', 'NO_TOPIC', msg.NO_TOPIC);
  }

  if (!DIFFICULTIES.includes(b.difficulty) && b.difficulty !== 'mixed') return fail('difficulty', 'BAD_DIFFICULTY', 'Please choose a difficulty level.');

  const total = Number(b.totalQuestions);
  if (!Number.isInteger(total) || total < 1 || total > MAX_QUESTIONS) return fail('totalQuestions', 'BAD_COUNT', msg.BAD_COUNT);
  if (subjects.length > total) return fail('totalQuestions', 'BAD_COUNT', 'Please request at least one question per selected subject.');

  let distribution = null;
  if (b.distribution && Object.keys(b.distribution).length) {
    distribution = {};
    for (const id of subjects) {
      const n = Number(b.distribution[id]);
      if (!Number.isInteger(n) || n < 1) return fail('distribution', 'BAD_COUNT', msg.BAD_COUNT);
      distribution[id] = n;
    }
    if (Object.values(distribution).reduce((a, c) => a + c, 0) !== total) {
      return fail('distribution', 'BAD_COUNT', 'The per-subject question counts must add up to the total number of questions.');
    }
  }

  return { ok: true, value: { subjects, topics, customSubtopics: custom, difficulty: b.difficulty, totalQuestions: total, distribution } };
}

module.exports = { norm, parseSubtopics, matchesSubject, localRelevance, checkSubtopics, validateRequest };
