const Question = require('../models/Question');
const { scoreAttempt } = require('./scoring');

// Full report for a FINISHED attempt, built from saved data only.
async function buildReport(attempt, test) {
  const questions = await Question.find({ testId: attempt.testId }).sort({ order: 1 });
  const r = scoreAttempt(questions, attempt.answers);
  const marked = new Map((attempt.answers || []).map((a) => [String(a.questionId), !!a.marked]));
  const rows = (attempt.topicBreakdown || []).map((t) => ({ ...(t.toObject ? t.toObject() : t), accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0 }));
  return {
    attempt: {
      _id: attempt._id, status: attempt.status, score: attempt.score, total: attempt.total, percentage: attempt.percentage,
      correctCount: attempt.correctCount ?? r.correctCount, incorrectCount: attempt.incorrectCount ?? r.incorrectCount,
      unansweredCount: attempt.unansweredCount ?? r.unansweredCount, timeTakenSec: attempt.timeTakenSec ?? null,
      startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, topicBreakdown: attempt.topicBreakdown,
      subjectBreakdown: attempt.subjectBreakdown, difficultyBreakdown: attempt.difficultyBreakdown, feedback: attempt.feedback,
      strengths: rows.filter((t) => t.total >= 1 && t.accuracy >= 70).map((t) => t.topic),
      weaknesses: rows.filter((t) => t.total >= 1 && t.accuracy < 50).map((t) => t.topic),
    },
    test: test && { _id: test._id, title: test.title, topic: test.topic, config: test.config, difficulty: test.difficulty },
    review: r.review.map((x) => ({ ...x, marked: marked.get(String(x.questionId)) || false })),
  };
}

module.exports = { buildReport };
