// DB-touching helpers for the timed attempt lifecycle.
const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const ai = require('./aiService');
const { scoreAttempt } = require('./scoring');
const { originalToDisplayed, isPermutation } = require('./shuffle');
const { mergeAnswers } = require('./answers');

const orderMap = (attempt) => new Map((attempt.optionOrders || []).map((o) => [String(o.questionId), o.order]));

// Atomically close an in-progress attempt (so two requests cannot finalize it twice), then score it.
// Returns the up-to-date attempt document.
async function finalizeAttempt(attemptId, test, status) {
  const now = new Date();
  const claimed = await Attempt.findOneAndUpdate(
    { _id: attemptId, status: 'in_progress' },
    { $set: { status, submittedAt: now } },
    { new: true }
  );
  if (!claimed) return Attempt.findById(attemptId); // someone else already finalized it

  const questions = await Question.find({ testId: claimed.testId }).sort({ order: 1 });
  const r = scoreAttempt(questions, claimed.answers);
  const feedback = await ai.generateFeedback({ testTitle: test.title, percentage: r.percentage, topicBreakdown: r.topicBreakdown });

  let taken = Math.max(0, Math.round((now - claimed.startedAt) / 1000));
  if (claimed.durationSeconds > 0) taken = Math.min(taken, claimed.durationSeconds); // grace window never counts as extra time

  claimed.answers = r.answers;
  claimed.score = r.score; claimed.total = r.total; claimed.percentage = r.percentage;
  claimed.correctCount = r.correctCount; claimed.incorrectCount = r.incorrectCount; claimed.unansweredCount = r.unansweredCount;
  claimed.topicBreakdown = r.topicBreakdown;
  claimed.subjectBreakdown = r.subjectBreakdown;
  claimed.difficultyBreakdown = r.difficultyBreakdown;
  claimed.timeTakenSec = taken;
  claimed.feedback = feedback;
  await claimed.save();
  return claimed;
}

// What the browser may see while the test is running: shuffled, WITHOUT correct answers or explanations.
function buildSession(attempt, test, questions) {
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const orders = orderMap(attempt);
  const ans = new Map((attempt.answers || []).map((a) => [String(a.questionId), a]));
  const shown = [];
  const answers = [];
  for (const qid of attempt.questionOrder) {
    const q = byId.get(String(qid));
    const order = orders.get(String(qid));
    if (!q || !isPermutation(order)) continue;
    shown.push({ _id: q._id, text: q.text, options: order.map((i) => q.options[i]), subject: q.subject, difficulty: q.difficulty });
    const a = ans.get(String(qid));
    answers.push({ questionId: q._id, selected: a ? originalToDisplayed(order, a.selected) : null, marked: !!a?.marked, timeSpentSec: a?.timeSpentSec || 0 });
  }
  return {
    attempt: {
      _id: attempt._id, status: attempt.status, startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt,
      durationSeconds: attempt.durationSeconds, serverNow: Date.now(),
    },
    test: { _id: test._id, title: test.title, topic: test.topic },
    questions: shown, answers,
  };
}

module.exports = { mergeAnswers, finalizeAttempt, buildSession };
