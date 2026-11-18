// Pure aggregation over FINISHED attempts (plain objects). Only real saved data is used.
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (c, t) => (t ? r2((c / t) * 100) : 0);

function mergeRows(attempts, field, keyName) {
  const m = new Map();
  for (const a of attempts) {
    for (const row of a[field] || []) {
      const k = row[keyName];
      if (!k) continue;
      const cur = m.get(k) || { [keyName]: k, correct: 0, total: 0, timeSpentSec: 0 };
      cur.correct += row.correct || 0;
      cur.total += row.total || 0;
      cur.timeSpentSec += row.timeSpentSec || 0;
      m.set(k, cur);
    }
  }
  return [...m.values()].map((r) => ({
    ...r, incorrect: r.total - r.correct, accuracy: pct(r.correct, r.total),
    avgTimePerQuestionSec: r.total && r.timeSpentSec ? r2(r.timeSpentSec / r.total) : null,
  }));
}

function overview(attempts) {
  const n = attempts.length;
  const totalQ = attempts.reduce((s, a) => s + (a.total || 0), 0);
  const totalC = attempts.reduce((s, a) => s + (a.score || 0), 0);
  return {
    totalAttempts: n,
    averageScore: n ? r2(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / n) : 0,
    highestScore: n ? Math.max(...attempts.map((a) => a.percentage || 0)) : 0,
    overallAccuracy: pct(totalC, totalQ),
    totalQuestions: totalQ,
    totalCorrect: totalC,
  };
}

// Compare the average of the latest 5 attempts with the 5 before them.
function learningProgress(attemptsNewestFirst) {
  const avg = (xs) => (xs.length ? xs.reduce((s, a) => s + (a.percentage || 0), 0) / xs.length : null);
  const latest = attemptsNewestFirst.slice(0, 5);
  const previous = attemptsNewestFirst.slice(5, 10);
  const a = avg(latest); const b = avg(previous);
  return { latestAverage: a === null ? null : r2(a), previousAverage: b === null ? null : r2(b), change: a !== null && b !== null ? r2(a - b) : null };
}

const MIN_Q = 2; // topics with fewer answered questions are not rated
function strongWeak(topics) {
  const rated = topics.filter((t) => t.total >= MIN_Q);
  return {
    strong: rated.filter((t) => t.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5),
    weak: rated.filter((t) => t.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5),
  };
}

function performance(attemptsNewestFirst) {
  const attempts = [...attemptsNewestFirst].reverse(); // oldest first for the trend
  const topics = mergeRows(attempts, 'topicBreakdown', 'topic');
  const subjects = mergeRows(attempts, 'subjectBreakdown', 'key').map(({ key, ...rest }) => ({ subject: key, ...rest }));
  const order = { easy: 0, medium: 1, hard: 2 };
  const difficulties = mergeRows(attempts, 'difficultyBreakdown', 'key')
    .map(({ key, ...rest }) => ({ difficulty: key, ...rest })).sort((a, b) => order[a.difficulty] - order[b.difficulty]);

  const timed = difficulties.reduce((s, d) => ({ t: s.t + d.timeSpentSec, q: s.q + (d.timeSpentSec ? d.total : 0) }), { t: 0, q: 0 });
  const ov = overview(attempts);
  return {
    overview: ov,
    incorrectTotal: ov.totalQuestions - ov.totalCorrect,
    avgTimePerQuestionSec: timed.q ? r2(timed.t / timed.q) : null,
    subjects, topics, difficulties,
    trend: attempts.map((a) => ({ attemptId: a._id, date: a.submittedAt, title: a.title, percentage: a.percentage })),
    ...strongWeak(topics),
  };
}

function recommendedTopics(topics, limit = 4) {
  return topics.filter((t) => t.total >= MIN_Q && t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
}

module.exports = { overview, performance, learningProgress, recommendedTopics, strongWeak, pct };
