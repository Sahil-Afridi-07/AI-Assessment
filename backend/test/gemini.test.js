// Gemini error handling, exercised with a stubbed global fetch (no network, no real key).
const test = require('node:test');
const assert = require('node:assert');

process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-key-not-real';
process.env.AI_RETRY_DELAY_MS = '0';
process.env.AI_TIMEOUT_MS = '50';
const ai = require('../src/services/aiService');

const realFetch = global.fetch;
test.afterEach(() => { global.fetch = realFetch; });

const reply = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj });
const gem = (text) => reply({ candidates: [{ content: { parts: [{ text }] } }] });
const q = (i, d = 'easy') => ({ text: `Unique question number ${i} about inheritance`, options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], correctOption: i % 4, difficulty: d, topic: 'OOP', explanation: 'x' });
const section = (difficulties) => ai.generateSection({ subject: 'python', subjectName: 'Python', focus: ['OOP'], difficulties });

test('valid response -> questions', async () => {
  global.fetch = async () => gem(JSON.stringify([q(1), q(2)]));
  const out = await section(['easy', 'easy']);
  assert.equal(out.length, 2);
});

test('markdown-fenced JSON is accepted', async () => {
  global.fetch = async () => gem('```json\n' + JSON.stringify([q(1)]) + '\n```');
  assert.equal((await section(['easy'])).length, 1);
});

test('rate limit (429) is retried once, then surfaces as AI_RATE_LIMIT', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return reply({}, 429); };
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_RATE_LIMIT');
  assert.ok(calls >= 2);
});

test('transient 429 then success works', async () => {
  let calls = 0;
  global.fetch = async () => (++calls === 1 ? reply({}, 429) : gem(JSON.stringify([q(1)])));
  assert.equal((await section(['easy'])).length, 1);
});

test('malformed JSON / empty array / empty body -> NO_QUESTIONS', async () => {
  for (const body of ['not json at all', '[]', '{"foo":1}']) {
    global.fetch = async () => gem(body);
    await assert.rejects(section(['easy']), (e) => e.code === 'NO_QUESTIONS', body);
  }
  global.fetch = async () => reply({ candidates: [] });
  await assert.rejects(section(['easy']), (e) => ['AI_EMPTY', 'NO_QUESTIONS'].includes(e.code));
});

test('network failure -> AI_NETWORK; hang -> AI_TIMEOUT; 500 -> AI_UPSTREAM; 400 -> AI_HTTP', async () => {
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_NETWORK');
  global.fetch = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_TIMEOUT');
  global.fetch = async () => reply({}, 500);
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_UPSTREAM');
  global.fetch = async () => reply({ error: { message: 'secret detail' } }, 400);
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_HTTP' && !/secret/.test(e.message));
});

test('missing API key -> AI_NOT_CONFIGURED (no fetch made)', async () => {
  const k = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  let called = false;
  global.fetch = async () => { called = true; return gem('[]'); };
  await assert.rejects(section(['easy']), (e) => e.code === 'AI_NOT_CONFIGURED');
  assert.equal(called, false);
  process.env.GEMINI_API_KEY = k;
});

test('partial output is topped up by follow-up calls until the count matches', async () => {
  let n = 0;
  global.fetch = async () => { n++; return gem(JSON.stringify(n === 1 ? [q(1), q(2)] : [q(3), q(4)])); };
  const out = await section(['easy', 'easy', 'easy', 'easy']);
  assert.equal(out.length, 4);
  assert.equal(new Set(out.map((x) => x.text)).size, 4);
});

test('endless junk after retries -> NO_QUESTIONS (never a short test)', async () => {
  global.fetch = async () => gem(JSON.stringify([q(1)])); // same question every time -> only 1 unique
  await assert.rejects(section(['easy', 'easy', 'easy']), (e) => e.code === 'NO_QUESTIONS');
});

test('relevance check parses verdicts; failures propagate so the caller fails closed', async () => {
  global.fetch = async () => gem(JSON.stringify({ results: [{ subtopic: 'metaclasses', relevant: true }, { subtopic: 'pizza', relevant: false }] }));
  assert.deepEqual(await ai.checkRelevance('Python', ['metaclasses', 'pizza']), { metaclasses: true, pizza: false });
  global.fetch = async () => { throw new TypeError('down'); };
  await assert.rejects(ai.checkRelevance('Python', ['x']));
});

test('feedback and analysis fall back to rule-based text when Gemini fails', async () => {
  global.fetch = async () => reply({}, 500);
  const f = await ai.generateFeedback({ testTitle: 'T', percentage: 50, topicBreakdown: [{ topic: 'A', correct: 0, total: 2 }] });
  assert.match(f, /revision on: A/);
  const a = await ai.generatePerformanceAnalysis({ attempts: 1, questions: 4, overallAccuracy: 50, topics: [{ topic: 'A', correct: 0, total: 4, accuracy: 0 }] });
  assert.equal(a.source, 'rules');
});
