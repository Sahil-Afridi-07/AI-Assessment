const router = require('express').Router();
const ClassBatch = require('../models/ClassBatch');
const Test = require('../models/Test');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const { classAnalytics } = require('../services/analytics');

router.use(protect, requireRole('teacher'));

const mine = async (req, res) => {
  const c = await ClassBatch.findOne({ _id: req.params.id, teacherId: req.user._id });
  if (!c) res.status(404).json({ message: 'Class not found' });
  return c;
};

router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Class name is required' });
  const c = await ClassBatch.create({ teacherId: req.user._id, name });
  res.status(201).json({ class: c });
}));

router.get('/', asyncHandler(async (req, res) => {
  const classes = await ClassBatch.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
  res.json({ classes });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await mine(req, res); if (!c) return;
  const [students, tests] = await Promise.all([
    User.find({ _id: { $in: c.studentIds } }).select('name email'),
    Test.find({ _id: { $in: c.testIds } }).select('title topic difficulty isPublished questionCount'),
  ]);
  res.json({ class: c, students, tests });
}));

// Add students by registered email
router.post('/:id/students', asyncHandler(async (req, res) => {
  const c = await mine(req, res); if (!c) return;
  const emails = [].concat(req.body?.emails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return res.status(400).json({ message: 'Provide at least one email' });
  const users = await User.find({ email: { $in: emails }, role: 'student' });
  const found = new Set(users.map((u) => u.email));
  await ClassBatch.updateOne({ _id: c._id }, { $addToSet: { studentIds: { $each: users.map((u) => u._id) } } });
  res.json({ added: users.length, notFound: emails.filter((e) => !found.has(e)) });
}));

router.delete('/:id/students/:studentId', asyncHandler(async (req, res) => {
  const c = await mine(req, res); if (!c) return;
  await ClassBatch.updateOne({ _id: c._id }, { $pull: { studentIds: req.params.studentId } });
  res.json({ ok: true });
}));

// Assign one of my tests to the class
router.post('/:id/assign', asyncHandler(async (req, res) => {
  const c = await mine(req, res); if (!c) return;
  const test = await Test.findOne({ _id: req.body?.testId, createdBy: req.user._id, kind: 'class' });
  if (!test) return res.status(404).json({ message: 'Test not found' });
  if (!test.isPublished) return res.status(400).json({ message: 'Publish the test before assigning it' });
  await ClassBatch.updateOne({ _id: c._id }, { $addToSet: { testIds: test._id } });
  res.json({ ok: true });
}));

router.get('/:id/analytics', asyncHandler(async (req, res) => {
  const c = await mine(req, res); if (!c) return;
  const [students, attempts] = await Promise.all([
    User.find({ _id: { $in: c.studentIds } }).select('name email'),
    Attempt.find({ testId: { $in: c.testIds }, studentId: { $in: c.studentIds }, status: { $ne: 'in_progress' } }),
  ]);
  const a = attempts.map((x) => x.toObject());
  res.json(classAnalytics(a, students.map((s) => ({ id: s._id, name: s.name, email: s.email }))));
}));

module.exports = router;
