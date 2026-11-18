// Profile, password, notification preferences and account deletion (any authenticated role).
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const Question = require('../models/Question');
const ClassBatch = require('../models/ClassBatch');
const { asyncHandler, protect } = require('../middleware/auth');
const { AppError } = require('../middleware/error');

router.use(protect);

const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const strongEnough = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

async function requirePassword(user, password) {
  if (!password || !(await bcrypt.compare(String(password), user.passwordHash))) {
    throw new AppError(403, 'Current password is incorrect.', 'BAD_PASSWORD');
  }
}

router.get('/', (req, res) => res.json({ user: req.user.toSafe() }));

// Name can change freely; changing the e-mail needs the current password.
router.patch('/profile', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 80) throw new AppError(400, 'Please enter a valid name (2-80 characters).', 'BAD_NAME');
    req.user.name = n;
  }
  if (email !== undefined && String(email).trim().toLowerCase() !== req.user.email) {
    const e = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new AppError(400, 'Please enter a valid email address.', 'BAD_EMAIL');
    await requirePassword(req.user, password);
    if (await User.exists({ email: e })) throw new AppError(409, 'That email is already registered.', 'DUPLICATE');
    req.user.email = e;
  }
  await req.user.save();
  res.json({ user: req.user.toSafe() });
}));

router.post('/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  await requirePassword(req.user, currentPassword);
  if (!strongEnough(newPassword)) throw new AppError(400, 'New password must be at least 8 characters and include a letter and a number.', 'WEAK_PASSWORD');
  if (newPassword === currentPassword) throw new AppError(400, 'New password must be different from the current one.', 'SAME_PASSWORD');
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.lastPasswordChangeAt = new Date(); // invalidates every older token
  await req.user.save();
  res.json({ token: sign(req.user), message: 'Password updated.' }); // fresh token keeps this session signed in
}));

router.patch('/preferences', asyncHandler(async (req, res) => {
  const allowed = ['emailOnResult', 'weeklySummary', 'practiceReminders'];
  for (const k of allowed) if (typeof req.body?.[k] === 'boolean') req.user.preferences[k] = req.body[k];
  await req.user.save();
  res.json({ preferences: req.user.preferences });
}));

// Students only: removes the account and everything it owns.
router.delete('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError(403, 'Please contact support to delete a teacher or company account.', 'FORBIDDEN');
  await requirePassword(req.user, req.body?.password);
  const mine = await Test.find({ createdBy: req.user._id, kind: 'practice' }).select('_id');
  await Promise.all([
    Attempt.deleteMany({ studentId: req.user._id }),
    Question.deleteMany({ testId: { $in: mine.map((t) => t._id) } }),
    Test.deleteMany({ _id: { $in: mine.map((t) => t._id) } }),
    ClassBatch.updateMany({}, { $pull: { studentIds: req.user._id } }),
  ]);
  await req.user.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
