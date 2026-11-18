const test = require('node:test');
const assert = require('node:assert');
const { scoreAttempt } = require('../src/services/scoring');
const { rankCandidates, classAnalytics, progressByTopic } = require('../src/services/analytics');
const { normalizeQuestions, parseJsonLoose } = require('../src/services/validateQuestions');
const ai = require('../src/services/aiService');

const Qs = [
  { _id: 'q1', text: 'a', options: ['1', '2', '3', '4'], correctOption: 1, topic: 'Arrays' },
  { _id: 'q2', text: 'b', options: ['1', '2', '3', '4'], correctOption: 0, topic: 'Arrays' },
  { _id: 'q3', text: 'c', options: ['1', '2', '3', '4'], correctOption: 3, topic: 'Trees' },
  { _id: 'q4', text: 'd', options: ['1', '2', '3', '4'], correctOption: 2, topic: 'Trees' },
];

test('scoring: counts correct answers, handles unanswered and invalid values', () => {
  const r = scoreAttempt(Qs, [
    { questionId: 'q1', selected: 1 },   // correct
    { questionId: 'q2', selected: 2 },   // wrong
    { questionId: 'q3', selected: 3 },   // correct
    { questionId: 'q4', selected: 99 },  // invalid -> unanswered
  ]);
  assert.equal(r.score, 2);
  assert.equal(r.total, 4);
  assert.equal(r.percentage, 50);
  assert.deepEqual(r.topicBreakdown, [
    { topic: 'Arrays', correct: 1, total: 2 },
    { topic: 'Trees', correct: 1, total: 2 },
  ]);
  assert.equal(r.review[3].selected, null);
  assert.equal(r.review[0].isCorrect, true);
});

test('scoring: option index 0 is a valid answer (falsy-value bug guard)', () => {
  const r = scoreAttempt([Qs[1]], [{ questionId: 'q2', selected: 0 }]);
  assert.equal(r.score, 1);
});

test('scoring: no answers -> 0, empty test -> 0%', () => {
  assert.equal(scoreAttempt(Qs, []).score, 0);
  assert.equal(scoreAttempt([], []).percentage, 0);
});

test('ranking: by percentage, earlier submission breaks ties, equal pct shares rank', () => {
  const r = rankCandidates([
    { name: 'A', percentage: 80, submittedAt: '2026-01-02' },
    { name: 'B', percentage: 90, submittedAt: '2026-01-03' },
    { name: 'C', percentage: 80, submittedAt: '2026-01-01' },
  ]);
  assert.deepEqual(r.map((x) => x.name), ['B', 'C', 'A']);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 2]);
});

test('class analytics: average, distribution, weakest topic first', () => {
  const attempts = [
    { studentId: 's1', percentage: 50, topicBreakdown: [{ topic: 'Arrays', correct: 1, total: 2 }, { topic: 'Trees', correct: 0, total: 2 }] },
    { studentId: 's2', percentage: 90, topicBreakdown: [{ topic: 'Arrays', correct: 2, total: 2 }, { topic: 'Trees', correct: 1, total: 2 }] },
  ];
  const a = classAnalytics(attempts, [{ id: 's1', name: 'S1', email: 'a' }, { id: 's2', name: 'S2', email: 'b' }, { id: 's3', name: 'S3', email: 'c' }]);
  assert.equal(a.averagePercentage, 70);
  assert.equal(a.distribution['40-59'], 1);
  assert.equal(a.distribution['80-100'], 1);
  assert.equal(a.weakestTopics[0].topic, 'Trees');
  assert.equal(a.perStudent.find((p) => p.studentId === 's3').averagePercentage, null);
});

test('progress by topic aggregates across attempts', () => {
  const p = progressByTopic([
    { topicBreakdown: [{ topic: 'X', correct: 1, total: 2 }] },
    { topicBreakdown: [{ topic: 'X', correct: 3, total: 4 }] },
  ]);
  assert.deepEqual(p, [{ topic: 'X', correct: 4, total: 6, accuracy: 66.67 }]);
});

test('LLM output validation drops malformed / duplicate questions', () => {
  const good = { text: 'Q?', options: ['a', 'b', 'c', 'd'], correctOption: 2, topic: 'T' };
  const out = normalizeQuestions([
    good,
    { ...good },                                   // duplicate text
    { text: 'x', options: ['a', 'b', 'c'], correctOption: 0 },        // 3 options
    { text: 'y', options: ['a', 'a', 'c', 'd'], correctOption: 0 },   // duplicate options
    { text: 'z', options: ['a', 'b', 'c', 'd'], correctOption: 4 },   // bad index
    { text: 'w', options: ['a', 'b', 'c', 'd'], correctOption: '1' }, // not integer
    null,
  ], 'Fallback');
  assert.equal(out.length, 1);
  assert.equal(out[0].generatedBy, 'AI');
  assert.equal(normalizeQuestions({ questions: [good] }, 'F').length, 1);
  assert.deepEqual(normalizeQuestions('nope', 'F'), []);
});

test('parseJsonLoose handles code fences and garbage', () => {
  assert.deepEqual(parseJsonLoose('```json\n[1,2]\n```'), [1, 2]);
  assert.equal(parseJsonLoose('not json'), null);
});

test('mock AI provider returns valid questions with correct answer at index', async () => {
  process.env.AI_PROVIDER = 'mock';
  const qs = await ai.generateQuestions({ topic: 'DBMS', difficulty: 'easy', count: 9 });
  assert.equal(qs.length, 9);
  assert.equal(normalizeQuestions(qs, 'DBMS').length, 9); // all pass validation
  const f = await ai.generateFeedback({ testTitle: 'T', percentage: 40, topicBreakdown: [{ topic: 'A', correct: 0, total: 2 }, { topic: 'B', correct: 2, total: 2 }] });
  assert.match(f, /Strong areas: B/);
  assert.match(f, /revision on: A/);
});
