const router = require('express').Router();
const Test = require('../models/Test');
const Question = require('../models/Question');
const ClassBatch = require('../models/ClassBatch');
const JobRole = require('../models/JobRole');
const Attempt = require('../models/Attempt');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const ai = require('../services/aiService');
const { canTakeTest, isOwner } = require('../services/access');

const DIFFS = ['easy', 'medium', 'hard'];

function validateManual(q) {
  return (
    q && typeof q.text === 'string' && q.text.trim() &&
    Array.isArray(q.options) && q.options.length === 4 &&
    q.options.every((o) => typeof o === 'string' && o.trim()) &&
    Number.isInteger(q.correctOption) && q.correctOption >= 0 && q.correctOption <= 3
  );
}

async function saveQuestions(testId, list, fallbackTopic) {
  const docs = list.map((q, i) => ({
    testId,
    text: q.text.trim(),
    options: q.options.map((o) => o.trim()),
    correctOption: q.correctOption,
    topic: (q.topic && String(q.topic).trim()) || fallbackTopic,
    generatedBy: q.generatedBy === 'AI' ? 'AI' : 'Manual',
    order: i,
  }));
  return Question.insertMany(docs);
}

// STUDENT: generate an AI practice test by topic/difficulty/count
router.post('/practice', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const { topic, difficulty = 'medium', count = 5 } = req.body || {};
  if (!topic || !String(topic).trim()) return res.status(400).json({ message: 'Topic is required' });
  if (!DIFFS.includes(difficulty)) return res.status(400).json({ message: 'Invalid difficulty' });
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 20) return res.status(400).json({ message: 'Count must be 1-20' });

  const questions = await ai.generateQuestions({ topic: String(topic).trim(), difficulty, count: n });
  const test = await Test.create({
    title: `${String(topic).trim()} (${difficulty})`,
    topic: String(topic).trim(), difficulty, source: 'AI', kind: 'practice',
    createdBy: req.user._id, isPublished: true, questionCount: questions.length,
  });
  await saveQuestions(test._id, questions, test.topic);
  res.status(201).json({ test });
}));

// TEACHER / COMPANY: create a test (manual, AI-previewed, or mixed)
router.post('/', protect, requireRole('teacher', 'company'), asyncHandler(async (req, res) => {
  const { title, topic, difficulty = 'medium', questions } = req.body || {};
  if (!title || !topic) return res.status(400).json({ message: 'Title and topic are required' });
  if (!DIFFS.includes(difficulty)) return res.status(400).json({ message: 'Invalid difficulty' });
  if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'Add at least one question' });
  const bad = questions.findIndex((q) => !validateManual(q));
  if (bad !== -1) return res.status(400).json({ message: `Question ${bad + 1} is invalid (need text, 4 options, a correct option)` });

  const nAI = questions.filter((q) => q.generatedBy === 'AI').length;
  const source = nAI === 0 ? 'Manual' : nAI === questions.length ? 'AI' : 'Mixed';
  const test = await Test.create({
    title: String(title).trim(), topic: String(topic).trim(), difficulty, source,
    kind: req.user.role === 'teacher' ? 'class' : 'screening',
    createdBy: req.user._id, isPublished: false, questionCount: questions.length,
  });
  await saveQuestions(test._id, questions, test.topic);
  res.status(201).json({ test });
}));

router.patch('/:id/publish', protect, requireRole('teacher', 'company'), asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test || !isOwner(req.user, test)) return res.status(404).json({ message: 'Test not found' });
  test.isPublished = req.body?.isPublished !== false;
  await test.save();
  res.json({ test });
}));

router.delete('/:id', protect, requireRole('teacher', 'company'), asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test || !isOwner(req.user, test)) return res.status(404).json({ message: 'Test not found' });
  await Promise.all([
    Question.deleteMany({ testId: test._id }),
    ClassBatch.updateMany({}, { $pull: { testIds: test._id } }),
    JobRole.updateMany({}, { $pull: { testIds: test._id } }),
  ]);
  await test.deleteOne();
  res.json({ ok: true });
}));

// Tests created by me (teacher/company) or my practice tests (student)
router.get('/mine', protect, asyncHandler(async (req, res) => {
  const tests = await Test.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ tests });
}));

// STUDENT: tests assigned via class or screening invite, with attempt status
router.get('/assigned', protect, requireRole('student'), asyncHandler(async (req, res) => {
  const [classes, roles] = await Promise.all([
    ClassBatch.find({ studentIds: req.user._id }).populate('teacherId', 'name'),
    JobRole.find({ invitedEmails: req.user.email }).populate('companyId', 'name'),
  ]);
  const meta = new Map(); // testId -> { from }
  classes.forEach((c) => c.testIds.forEach((t) => meta.set(String(t), `Class: ${c.name} (${c.teacherId?.name || ''})`)));
  roles.forEach((r) => r.testIds.forEach((t) => meta.set(String(t), `Job: ${r.roleName} - ${r.companyId?.name || ''}`)));

  const tests = await Test.find({ _id: { $in: [...meta.keys()] }, isPublished: true }).sort({ createdAt: -1 });
  const done = await Attempt.find({ studentId: req.user._id, status: { $ne: 'in_progress' }, testId: { $in: tests.map((t) => t._id) } }).select('testId percentage');
  const doneMap = new Map(done.map((a) => [String(a.testId), a]));
  res.json({
    tests: tests.map((t) => ({
      ...t.toObject(),
      assignedFrom: meta.get(String(t._id)),
      attempted: doneMap.has(String(t._id)),
      attemptId: doneMap.get(String(t._id))?._id || null,
      percentage: doneMap.get(String(t._id))?.percentage ?? null,
    })),
  });
}));

// Get a test. Students get it WITHOUT correct answers. Owners get the full test.
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ message: 'Test not found' });
  const questions = await Question.find({ testId: test._id }).sort({ order: 1 });

  if (isOwner(req.user, test) && req.user.role !== 'student') {
    return res.json({ test, questions });
  }
  if (!(await canTakeTest(req.user, test))) return res.status(404).json({ message: 'Test not found' });
  res.json({
    test,
    questions: questions.map((q) => ({ _id: q._id, text: q.text, options: q.options, topic: q.topic })),
  });
}));

module.exports = router;
