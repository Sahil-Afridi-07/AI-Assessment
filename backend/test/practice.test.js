const test = require('node:test');
const assert = require('node:assert');
const alloc = require('../src/services/allocation');
const timing = require('../src/services/timing');
const shuf = require('../src/services/shuffle');
const iv = require('../src/services/inputValidation');
const vq = require('../src/services/validateQuestions');
const stats = require('../src/services/studentStats');
const { scoreAttempt } = require('../src/services/scoring');
const ai = require('../src/services/aiService');
const msg = require('../src/services/messages');

process.env.AI_PROVIDER = 'mock';

// ---------- allocation / time ----------
test('allocateCounts: even split with remainder, always sums to total', () => {
  const r = alloc.allocateCounts(['a', 'b', 'c'], 20);
  assert.deepEqual(r.counts, { a: 7, b: 7, c: 6 });
  for (const total of [3, 7, 20, 30]) {
    const x = alloc.allocateCounts(['a', 'b', 'c'], total);
    assert.equal(Object.values(x.counts).reduce((s, n) => s + n, 0), total);
  }
});
test('allocateCounts: manual split must sum to total; limits enforced', () => {
  assert.equal(alloc.allocateCounts(['a', 'b'], 10, { a: 5, b: 5 }).ok, true);
  assert.equal(alloc.allocateCounts(['a', 'b'], 10, { a: 5, b: 4 }).error, 'MANUAL_SUM');
  assert.equal(alloc.allocateCounts(['a', 'b'], 10, { a: 10, b: 0 }).error, 'MANUAL_INVALID');
  assert.equal(alloc.allocateCounts(['a'], 31).ok, false);
  assert.equal(alloc.allocateCounts(['a'], 0).ok, false);
  assert.equal(alloc.allocateCounts(['a'], 2.5).ok, false);
  assert.equal(alloc.allocateCounts(['a', 'b', 'c'], 2).ok, false);
});
test('difficultyPlan: fixed modes and mixed (40/40/20)', () => {
  assert.deepEqual(alloc.difficultyPlan(3, 'hard'), ['hard', 'hard', 'hard']);
  const m = alloc.countBy(alloc.difficultyPlan(20, 'mixed').map((d) => ({ d })), 'd');
  assert.deepEqual(m, { easy: 8, medium: 8, hard: 4 });
  assert.equal(alloc.difficultyPlan(5, 'mixed').length, 5);
  assert.equal(alloc.difficultyPlan(1, 'mixed').length, 1);
});
test('dealDifficulties: each subject gets exactly its count and total mix is preserved', () => {
  const counts = { python: 5, dbms: 5, aptitude: 5, reasoning: 5 };
  const dealt = alloc.dealDifficulties(counts, 'mixed');
  let all = [];
  for (const k of Object.keys(counts)) { assert.equal(dealt[k].length, counts[k]); all = all.concat(dealt[k]); }
  assert.deepEqual(alloc.countBy(all.map((d) => ({ d })), 'd'), { easy: 8, medium: 8, hard: 4 });
});
test('duration: 5 easy + 10 medium + 5 hard = 30 minutes (spec example)', () => {
  const qs = [...Array(5).fill({ difficulty: 'easy' }), ...Array(10).fill({ difficulty: 'medium' }), ...Array(5).fill({ difficulty: 'hard' })];
  assert.equal(alloc.totalDurationSeconds(qs), 30 * 60);
});

// ---------- timing ----------
test('timing: deadline is server-computed, expiry honours grace, untimed never expires', () => {
  const start = new Date('2026-01-01T10:00:00Z');
  const dl = timing.deadlineFor(start, 600);
  assert.equal(dl.toISOString(), '2026-01-01T10:10:00.000Z');
  const at = (s) => new Date(start.getTime() + s * 1000).getTime();
  assert.equal(timing.isExpired(dl, at(599)), false);
  assert.equal(timing.isExpired(dl, at(603)), false); // within 5s grace
  assert.equal(timing.isExpired(dl, at(606)), true);
  assert.equal(timing.deadlineFor(start, 0), null);
  assert.equal(timing.isExpired(null, Date.now() + 1e12), false);
  assert.equal(timing.secondsRemaining(dl, at(590)), 10);
  assert.equal(timing.secondsRemaining(dl, at(900)), 0);
});
test('timing: client-reported time is clamped', () => {
  const start = new Date(Date.now() - 100 * 1000);
  assert.equal(timing.clampTimeSpent(99999, start), 100);
  assert.equal(timing.clampTimeSpent(-5, start), 0);
  assert.equal(timing.clampTimeSpent('abc', start), 0);
  assert.equal(timing.clampTimeSpent(30, start), 30);
});

// ---------- shuffle mapping keeps the correct answer ----------
test('shuffle: displayed<->original mapping round-trips and scoring uses the original index', () => {
  for (let n = 0; n < 50; n++) {
    const order = shuf.makeOptionOrder();
    assert.ok(shuf.isPermutation(order));
    for (let orig = 0; orig < 4; orig++) {
      const shown = shuf.originalToDisplayed(order, orig);
      assert.equal(shuf.displayedToOriginal(order, shown), orig);
    }
  }
  const q = { _id: 'q', options: ['A', 'B', 'C', 'D'], correctOption: 2, topic: 't' };
  const order = [3, 2, 0, 1]; // displayed: D, C, A, B ; the correct 'C' is displayed at index 1
  const chosenDisplayed = 1;
  const original = shuf.displayedToOriginal(order, chosenDisplayed);
  assert.equal(scoreAttempt([q], [{ questionId: 'q', selected: original }]).score, 1);
  assert.equal(shuf.displayedToOriginal(order, 9), null);
  assert.equal(shuf.isPermutation([0, 0, 1, 2]), false);
});

// ---------- input validation ----------
const base = { subjects: ['python'], topics: { python: ['Object-Oriented Programming'] }, customSubtopics: {}, difficulty: 'medium', totalQuestions: 10 };
test('validateRequest: spec messages for empty subject/topic/count', () => {
  assert.equal(iv.validateRequest({ ...base, subjects: [] }).error.message, msg.NO_SUBJECT);
  assert.equal(iv.validateRequest({ ...base, topics: { python: [] } }).error.message, msg.NO_TOPIC);
  for (const bad of [0, -3, 2.5, 'abc', null, 31, 1000]) assert.equal(iv.validateRequest({ ...base, totalQuestions: bad }).error.message, msg.BAD_COUNT, String(bad));
  assert.equal(iv.validateRequest({ ...base, subjects: ['nope'] }).ok, false);
  assert.equal(iv.validateRequest({ ...base, difficulty: 'insane' }).error.field, 'difficulty');
  assert.equal(iv.validateRequest({ ...base, topics: { python: ['Not A Topic'] } }).ok, false);
  assert.equal(iv.validateRequest({ ...base, customSubtopics: { python: 12345 } }).error.message, msg.BAD_CUSTOM);
  assert.equal(iv.validateRequest(null).error.message, msg.NO_SUBJECT);
});
test('validateRequest: custom subtopics alone satisfy the topic rule; parsing splits commas/newlines/bullets', () => {
  const r = iv.validateRequest({ ...base, topics: { python: [] }, customSubtopics: { python: 'Inheritance, Polymorphism\n- Method Overriding\n2) Decorators, inheritance' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.customSubtopics.python, ['Inheritance', 'Polymorphism', 'Method Overriding', 'Decorators']);
  assert.equal(iv.validateRequest({ ...base, customSubtopics: { python: '!!!, ???' } }).ok, false);
  assert.equal(iv.validateRequest({ ...base, customSubtopics: { python: Array(11).fill(0).map((_, i) => `topic${i}x`).join(',') } }).ok, false);
});
test('validateRequest: distribution must sum to total; mixed totals', () => {
  const two = { ...base, subjects: ['python', 'dbms'], topics: { python: ['Strings'], dbms: ['SQL'] }, totalQuestions: 10 };
  assert.equal(iv.validateRequest({ ...two, distribution: { python: 5, dbms: 5 } }).ok, true);
  assert.equal(iv.validateRequest({ ...two, distribution: { python: 5, dbms: 4 } }).ok, false);
  assert.equal(iv.validateRequest({ ...two, totalQuestions: 1 }).ok, false); // < one question per subject
});
test('relevance: valid Python subtopics accepted, spec invalid examples rejected', () => {
  for (const s of ['Inheritance', 'Polymorphism', 'Exception Handling', 'Decorators', 'Method Overriding', 'Try-Except-Finally']) {
    assert.equal(iv.localRelevance('python', s).valid, true, s);
  }
  for (const s of ['Cricket', 'Bollywood', 'Weather', 'Cooking recipes', 'IPL cricket scores']) {
    assert.equal(iv.localRelevance('python', s).valid, false, s);
  }
  assert.equal(iv.localRelevance('python', 'Normalization').source, 'other-subject'); // belongs to DBMS
  assert.equal(iv.localRelevance('dbms', 'Normalization').valid, true);
  assert.equal(iv.localRelevance('python', 'zebra stripes in the savanna').valid, null); // undecided -> AI
});
test('checkSubtopics: unknown input fails CLOSED without AI, and follows AI verdicts with AI', async () => {
  assert.equal((await iv.checkSubtopics('python', ['zebra stripes'], null)).length, 1);
  assert.equal((await iv.checkSubtopics('python', ['zebra stripes'], async () => { throw new Error('down'); })).length, 1);
  assert.equal((await iv.checkSubtopics('python', ['metaclasses'], async () => ({ metaclasses: true }))).length, 0);
  assert.equal((await iv.checkSubtopics('python', ['metaclasses'], async () => ({ metaclasses: false }))).length, 1);
  assert.equal((await iv.checkSubtopics('python', ['metaclasses'], async () => ({}))).length, 1); // missing verdict
  assert.equal((await iv.checkSubtopics('python', ['Inheritance', 'Cricket'], async () => ({}))).length, 1);
  assert.match(msg.invalidTopic('Python'), /^Invalid Topic! The entered topic does not appear to be related to Python\./);
});

// ---------- generated question validation ----------
const good = (o = {}) => ({ text: 'What does inheritance allow in Python?', options: ['Code reuse', 'Faster CPU', 'New keyboard', 'None here'], correctOption: 0, difficulty: 'easy', topic: 'OOP', explanation: 'Because.', ...o });
const ctx = { subject: 'python', subjectName: 'Python', focus: ['OOP', 'Exception Handling'] };
test('section validation: accepts good, drops each kind of bad question', () => {
  const bad = [
    good({ options: ['a', 'b', 'c'] }), good({ options: ['a', 'a', 'b', 'c'] }), good({ correctOption: 4 }), good({ correctOption: '1' }),
    good({ difficulty: 'impossible' }), good({ topic: 'Cricket' }), good({ text: 'short' }),
    good({ options: ['Code reuse', 'All of the above', 'x', 'y'] }), good({ options: ['A and B', 'p', 'q', 'r'] }), good({ options: ['Both A and C', 'p', 'q', 'r'] }),
    good({ options: ['p', 'q', 'r', ''] }), null, 'junk',
  ];
  const out = vq.normalizeSectionQuestions([good(), ...bad], ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].subject, 'python');
  assert.equal(out[0].explanation, 'Because.');
});
test('section validation: duplicates, near-duplicates and previously seen questions are dropped; topic is canonicalised', () => {
  const a = good({ text: 'Which keyword creates a subclass in Python?', topic: 'oop' });
  const near = good({ text: 'Which keyword creates a subclass in Python??' });
  const other = good({ text: 'Explain how try except finally blocks execute', topic: 'exception handling' });
  const out = vq.normalizeSectionQuestions({ questions: [a, near, other] }, ctx);
  assert.equal(out.length, 2);
  assert.equal(out[0].topic, 'OOP');
  assert.equal(out[1].topic, 'Exception Handling');
  assert.equal(vq.normalizeSectionQuestions([a], { ...ctx, existing: ['Which keyword creates a subclass in Python?'] }).length, 0);
  assert.deepEqual(vq.normalizeSectionQuestions('nope', ctx), []);
});

// ---------- mock section generation satisfies the same validator ----------
test('generateSection (mock): exact count, requested difficulties, valid per validator', async () => {
  const difficulties = ['easy', 'hard', 'medium', 'easy', 'hard'];
  const qs = await ai.generateSection({ subject: 'dbms', subjectName: 'Database Management Systems', focus: ['SQL', 'Normalization'], difficulties });
  assert.equal(qs.length, 5);
  assert.deepEqual(qs.map((q) => q.difficulty), difficulties);
  const re = vq.normalizeSectionQuestions(qs, { subject: 'dbms', subjectName: 'x', focus: ['SQL', 'Normalization'] });
  assert.equal(re.length, 5);
});
test('relevance AI in mock mode returns null (caller fails closed)', async () => {
  assert.equal(await ai.checkRelevance('Python', ['x']), null);
});

// ---------- stats ----------
const att = (pct, score, total, extra = {}) => ({ _id: String(pct), title: `T${pct}`, percentage: pct, score, total, submittedAt: new Date(2026, 0, pct), ...extra });
test('stats: overview, performance aggregation and recommendations come only from saved data', () => {
  const newestFirst = [
    att(80, 8, 10, {
      topicBreakdown: [{ topic: 'OOP', correct: 2, total: 5 }, { topic: 'Strings', correct: 5, total: 5 }],
      subjectBreakdown: [{ key: 'python', correct: 7, total: 10, timeSpentSec: 300 }],
      difficultyBreakdown: [{ key: 'hard', correct: 2, total: 5, timeSpentSec: 200 }, { key: 'easy', correct: 5, total: 5, timeSpentSec: 100 }],
    }),
    att(40, 4, 10, { topicBreakdown: [{ topic: 'OOP', correct: 1, total: 5 }, { topic: 'Strings', correct: 3, total: 5 }] }), // legacy: no subject/difficulty
  ];
  const ov = stats.overview(newestFirst);
  assert.deepEqual([ov.totalAttempts, ov.averageScore, ov.highestScore, ov.overallAccuracy], [2, 60, 80, 60]);
  const p = stats.performance(newestFirst);
  assert.deepEqual(p.trend.map((t) => t.percentage), [40, 80]); // oldest first
  const oop = p.topics.find((t) => t.topic === 'OOP');
  assert.deepEqual([oop.correct, oop.total, oop.accuracy], [3, 10, 30]);
  assert.equal(p.subjects.length, 1);
  assert.deepEqual(p.difficulties.map((d) => d.difficulty), ['easy', 'hard']);
  assert.equal(p.avgTimePerQuestionSec, 30); // only attempts that recorded time
  assert.equal(p.incorrectTotal, 8);
  assert.deepEqual(p.weak.map((t) => t.topic), ['OOP']);
  assert.deepEqual(p.strong.map((t) => t.topic), ['Strings']);
  assert.deepEqual(stats.recommendedTopics(p.topics).map((t) => t.topic), ['OOP']);
  assert.deepEqual(stats.overview([]), { totalAttempts: 0, averageScore: 0, highestScore: 0, overallAccuracy: 0, totalQuestions: 0, totalCorrect: 0 });
  assert.equal(stats.performance([]).avgTimePerQuestionSec, null);
});
test('stats: learning progress compares latest 5 with previous 5', () => {
  const list = [90, 90, 90, 90, 90, 50, 50, 50, 50, 50].map((p) => ({ percentage: p }));
  assert.deepEqual(stats.learningProgress(list), { latestAverage: 90, previousAverage: 50, change: 40 });
  assert.equal(stats.learningProgress([{ percentage: 70 }]).change, null);
});
test('performance analysis (mock) is rule-based, uses only the supplied data', async () => {
  const topics = [{ topic: 'Strings', correct: 5, total: 5, accuracy: 100 }, { topic: 'OOP', correct: 1, total: 5, accuracy: 20 }];
  const a = await ai.generatePerformanceAnalysis({ attempts: 2, questions: 10, overallAccuracy: 60, topics });
  assert.equal(a.source, 'rules');
  assert.match(a.text, /well in Strings/);
  assert.match(a.text, /weakest areas are OOP/);
  const none = await ai.generatePerformanceAnalysis({ attempts: 1, questions: 1, overallAccuracy: 0, topics: [] });
  assert.match(none.text, /not yet enough data/);
});

// ---------- scoring extension ----------
test('scoring: subject/difficulty breakdowns, counts, explanations', () => {
  const qs = [
    { _id: 'a', text: 'a', options: ['1', '2', '3', '4'], correctOption: 0, topic: 'T1', subject: 'python', difficulty: 'easy', explanation: 'e1' },
    { _id: 'b', text: 'b', options: ['1', '2', '3', '4'], correctOption: 1, topic: 'T1', subject: 'python', difficulty: 'hard', explanation: 'e2' },
    { _id: 'c', text: 'c', options: ['1', '2', '3', '4'], correctOption: 2, topic: 'T2', subject: 'dbms', difficulty: 'hard' },
  ];
  const r = scoreAttempt(qs, [{ questionId: 'a', selected: 0, timeSpentSec: 10 }, { questionId: 'b', selected: 3, timeSpentSec: 20 }]);
  assert.deepEqual([r.correctCount, r.incorrectCount, r.unansweredCount], [1, 1, 1]);
  assert.deepEqual(r.subjectBreakdown.find((s) => s.key === 'python'), { key: 'python', correct: 1, total: 2, timeSpentSec: 30 });
  assert.equal(r.difficultyBreakdown.find((d) => d.key === 'hard').total, 2);
  assert.equal(r.review[0].explanation, 'e1');
});

test('section validation: numeric aptitude questions that differ only by numbers are NOT duplicates', () => {
  const mk = (t) => ({ text: t, options: ['10', '20', '30', '40'], correctOption: 1, difficulty: 'easy', topic: 'Percentages' });
  const out = vq.normalizeSectionQuestions([mk('What is 20% of 150?'), mk('What is 25% of 150?'), mk('What is 25% of 150?')],
    { subject: 'aptitude', subjectName: 'Aptitude', focus: ['Percentages'] });
  assert.equal(out.length, 2);
});

// ---------- answer merging (tamper resistance) ----------
const { mergeAnswers } = require('../src/services/answers');
test('mergeAnswers: maps displayed->original, ignores unknown ids and bad indexes, clamps time, supports clear', () => {
  const order = [3, 2, 0, 1];
  const start = new Date(Date.now() - 50 * 1000);
  const attempt = { startedAt: start, questionOrder: ['q1'], optionOrders: [{ questionId: 'q1', order }], answers: [] };

  mergeAnswers(attempt, [{ questionId: 'q1', selected: 1, marked: true, timeSpentSec: 9999 }, { questionId: 'evil', selected: 0 }]);
  assert.equal(attempt.answers.length, 1);
  assert.equal(attempt.answers[0].selected, 2); // displayed 1 -> original order[1] = 2
  assert.equal(attempt.answers[0].marked, true);
  assert.ok(attempt.answers[0].timeSpentSec <= 50);

  mergeAnswers(attempt, [{ questionId: 'q1', selected: 99 }]); // out of range: previous answer kept
  assert.equal(attempt.answers[0].selected, 2);
  mergeAnswers(attempt, [{ questionId: 'q1', selected: -1 }, { questionId: 'q1', selected: '2' }, { questionId: 'q1', selected: 1.5 }]);
  assert.equal(attempt.answers[0].selected, 2);
  mergeAnswers(attempt, [{ questionId: 'q1', marked: 'yes' }]); // only literal true counts
  assert.equal(attempt.answers[0].marked, false);
  mergeAnswers(attempt, [{ questionId: 'q1', selected: null }]);
  assert.equal(attempt.answers[0].selected, null);
  mergeAnswers(attempt, 'garbage');
  mergeAnswers(attempt, null);
  assert.equal(attempt.answers.length, 1);

  const sixty = Array.from({ length: 150 }, (_, i) => ({ questionId: 'q1', selected: 0, timeSpentSec: i }));
  mergeAnswers(attempt, sixty); // capped at 100 items, must not throw
  assert.equal(attempt.answers[0].selected, 3);
});
