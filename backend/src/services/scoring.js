// Deterministic scoring: compares the selected (ORIGINAL) option index with correctOption.
// No AI involved. Pure function - easy to unit test.
const bump = (map, key, correct, extra = {}) => {
  const row = map.get(key) || { key, correct: 0, total: 0, timeSpentSec: 0 };
  row.total += 1;
  if (correct) row.correct += 1;
  row.timeSpentSec += extra.timeSpentSec || 0;
  map.set(key, row);
};

function scoreAttempt(questions, answers) {
  const byQ = new Map();
  for (const a of answers || []) {
    if (a && a.questionId != null) byQ.set(String(a.questionId), a);
  }
  const topics = new Map();
  const subjects = new Map();
  const diffs = new Map();
  const review = [];
  const normalized = [];
  let score = 0;
  let unanswered = 0;

  for (const q of questions) {
    const a = byQ.get(String(q._id)) || {};
    const raw = a.selected;
    const selected = Number.isInteger(raw) && raw >= 0 && raw <= 3 ? raw : null;
    const correct = selected !== null && selected === q.correctOption;
    if (correct) score += 1;
    if (selected === null) unanswered += 1;
    const time = Number.isFinite(a.timeSpentSec) ? a.timeSpentSec : 0;

    const t = q.topic || 'General';
    const row = topics.get(t) || { topic: t, correct: 0, total: 0 };
    row.total += 1;
    if (correct) row.correct += 1;
    topics.set(t, row);
    if (q.subject) bump(subjects, q.subject, correct, { timeSpentSec: time });
    bump(diffs, q.difficulty || 'medium', correct, { timeSpentSec: time });

    normalized.push({ questionId: q._id, selected, marked: !!a.marked, timeSpentSec: time });
    review.push({
      questionId: q._id, text: q.text, options: q.options, selected, correctOption: q.correctOption,
      isCorrect: correct, topic: t, subject: q.subject || '', difficulty: q.difficulty || 'medium', explanation: q.explanation || '',
    });
  }

  const total = questions.length;
  const percentage = total ? Math.round((score / total) * 10000) / 100 : 0;
  return {
    score, total, percentage,
    correctCount: score, incorrectCount: total - score - unanswered, unansweredCount: unanswered,
    topicBreakdown: [...topics.values()],
    subjectBreakdown: [...subjects.values()],
    difficultyBreakdown: [...diffs.values()],
    answers: normalized, review,
  };
}

module.exports = { scoreAttempt };
