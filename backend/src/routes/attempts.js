const router = require('express').Router();
const Test = require('../models/Test');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const ai = require('../services/aiService');
const { scoreAttempt } = require('../services/scoring');
const { progressByTopic } = require('../services/analytics');
const { canTakeTest, isOwner } = require('../services/access');
const { deadlineFor, isExpired } = require('../services/timing');
const { shuffled, makeOptionOrder } = require('../services/shuffle');
const { buildReport } = require('../services/report');
const { mergeAnswers, finalizeAttempt, buildSession } = require('../services/attemptService');

const FINAL = { $ne: 'in_progress' }; // matches legacy attempts that have no status field

const ownAttempt = async (req) => {
  const a = await Attempt.findOne({ _id: req.params.id, studentId: req.user._id });
  if (!a) throw new AppError(404, 'Attempt not found', 'NOT_FOUND');
  return a;
};

// ---- Timed flow (student) ---------------------------------------------------

// Start (or resume) an attempt. The server stores startedAt/deadlineAt - the browser clock is never trusted.
router.post('/start', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const test = await Test.findById(req.body?.testId);
  if (!test || !(await canTakeTest(req.user, test))) throw new AppError(404, 'Test not found', 'NOT_FOUND');

  const open = await Attempt.findOne({ testId: test._id, studentId: req.user._id, status: 'in_progress' });
  if (open) {
    if (isExpired(open.deadlineAt)) await finalizeAttempt(open._id, test, 'auto_submitted');
    else return res.json({ attemptId: open._id, resumed: true });
  }
  if (test.kind !== 'practice' && (await Attempt.exists({ testId: test._id, studentId: req.user._id, status: FINAL }))) {
    throw new AppError(409, 'You have already attempted this test', 'ALREADY_ATTEMPTED');
  }

  const questions = await Question.find({ testId: test._id });
  if (!questions.length) throw new AppError(409, 'This test has no questions', 'EMPTY_TEST');

  const startedAt = new Date();
  const attempt = await Attempt.create({
    testId: test._id, studentId: req.user._id, status: 'in_progress',
    startedAt, durationSeconds: test.durationSeconds || 0, deadlineAt: deadlineFor(startedAt, test.durationSeconds || 0),
    questionOrder: shuffled(questions.map((q) => q._id)),
    optionOrders: questions.map((q) => ({ questionId: q._id, order: makeOptionOrder() })),
    answers: [],
    subjects: [...new Set(questions.map((q) => q.subject).filter(Boolean))],
    difficulties: [...new Set(questions.map((q) => q.difficulty))],
  });
  res.status(201).json({ attemptId: attempt._id, resumed: false });
}));

// Reload state after a refresh: same deadline, saved answers, same shuffled order.
router.get('/:id/session', protect, requireRole('student'), asyncHandler(async (req, res) => {
  let attempt = await ownAttempt(req);
  const test = await Test.findById(attempt.testId);
  if (attempt.status === 'in_progress' && isExpired(attempt.deadlineAt)) {
    attempt = await finalizeAttempt(attempt._id, test, 'auto_submitted');
  }
  if (attempt.status !== 'in_progress') return res.json({ finished: true, attemptId: attempt._id, status: attempt.status });
  const questions = await Question.find({ testId: attempt.testId });
  res.json(buildSession(attempt, test, questions));
}));

// Periodic autosave. Rejected after the deadline (and the attempt is closed with what was saved).
router.put('/:id/answers', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  if (attempt.status !== 'in_progress') throw new AppError(409, 'This assessment is already submitted.', 'FINISHED', { attemptId: attempt._id });
  if (isExpired(attempt.deadlineAt)) {
    const test = await Test.findById(attempt.testId);
    await finalizeAttempt(attempt._id, test, 'auto_submitted');
    throw new AppError(409, 'Time is up. Your saved answers were submitted.', 'EXPIRED', { attemptId: attempt._id });
  }
  mergeAnswers(attempt, req.body?.answers);
  await attempt.save();
  res.json({ savedAt: attempt.lastSavedAt, serverNow: Date.now() });
}));

// Final submit. After the deadline the payload is ignored and only previously saved answers count.
router.post('/:id/submit', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  if (attempt.status !== 'in_progress') return res.json({ attemptId: attempt._id, status: attempt.status, alreadySubmitted: true });
  const test = await Test.findById(attempt.testId);

  if (isExpired(attempt.deadlineAt)) {
    const done = await finalizeAttempt(attempt._id, test, 'auto_submitted');
    return res.json({ attemptId: done._id, status: done.status, expired: true });
  }
  mergeAnswers(attempt, req.body?.answers);
  await attempt.save();
  const done = await finalizeAttempt(attempt._id, test, req.body?.auto === true ? 'auto_submitted' : 'submitted');
  res.json({ attemptId: done._id, status: done.status });
}));

// ---- Legacy one-shot submit (kept for backward compatibility) -----------------
router.post('/', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const { testId, answers } = req.body || {};
  const test = await Test.findById(testId);
  if (!test || !(await canTakeTest(req.user, test))) return res.status(404).json({ message: 'Test not found' });
  if (test.kind !== 'practice' && (await Attempt.exists({ testId, studentId: req.user._id, status: FINAL }))) {
    return res.status(409).json({ message: 'You have already attempted this test' });
  }
  const questions = await Question.find({ testId: test._id }).sort({ order: 1 });
  const result = scoreAttempt(questions, answers);
  const feedback = await ai.generateFeedback({ testTitle: test.title, percentage: result.percentage, topicBreakdown: result.topicBreakdown });
  const now = new Date();
  const attempt = await Attempt.create({
    testId: test._id, studentId: req.user._id, status: 'submitted', startedAt: now, submittedAt: now, answers: result.answers,
    score: result.score, total: result.total, percentage: result.percentage,
    correctCount: result.correctCount, incorrectCount: result.incorrectCount, unansweredCount: result.unansweredCount, timeTakenSec: 0,
    topicBreakdown: result.topicBreakdown, subjectBreakdown: result.subjectBreakdown, difficultyBreakdown: result.difficultyBreakdown,
    subjects: [...new Set(questions.map((q) => q.subject).filter(Boolean))], difficulties: [...new Set(questions.map((q) => q.difficulty))],
    feedback,
  });
  res.status(201).json({
    attemptId: attempt._id, score: result.score, total: result.total, percentage: result.percentage,
    topicBreakdown: result.topicBreakdown, feedback, review: result.review,
  });
}));

// ---- History and review -------------------------------------------------------
router.get('/mine', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ studentId: req.user._id, status: FINAL }).sort({ submittedAt: -1 }).populate('testId', 'title topic difficulty kind');
  res.json({
    attempts: attempts.map((a) => ({
      _id: a._id, test: a.testId, score: a.score, total: a.total, percentage: a.percentage, submittedAt: a.submittedAt, status: a.status,
    })),
    progress: progressByTopic(attempts),
  });
}));

// Full review. Only finished attempts - correct answers are never exposed while a test is running.
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
  const test = await Test.findById(attempt.testId);
  const mine = String(attempt.studentId) === String(req.user._id);
  if (!mine && !(test && isOwner(req.user, test))) return res.status(404).json({ message: 'Attempt not found' });
  if (attempt.status === 'in_progress') {
    if (mine && isExpired(attempt.deadlineAt)) await finalizeAttempt(attempt._id, test, 'auto_submitted');
    else return res.status(409).json({ message: 'This assessment is still in progress.', code: 'IN_PROGRESS' });
  }
  const fresh = await Attempt.findById(attempt._id);
  res.json(await buildReport(fresh, test));
}));

module.exports = router;
