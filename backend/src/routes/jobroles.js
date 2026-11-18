const router = require('express').Router();
const JobRole = require('../models/JobRole');
const Test = require('../models/Test');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const { rankCandidates } = require('../services/analytics');

router.use(protect, requireRole('company'));

const mine = async (req, res) => {
  const r = await JobRole.findOne({ _id: req.params.id, companyId: req.user._id });
  if (!r) res.status(404).json({ message: 'Job role not found' });
  return r;
};

router.post('/', asyncHandler(async (req, res) => {
  const roleName = String(req.body?.roleName || '').trim();
  if (!roleName) return res.status(400).json({ message: 'Role name is required' });
  const r = await JobRole.create({ companyId: req.user._id, roleName });
  res.status(201).json({ jobRole: r });
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json({ jobRoles: await JobRole.find({ companyId: req.user._id }).sort({ createdAt: -1 }) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const r = await mine(req, res); if (!r) return;
  const tests = await Test.find({ _id: { $in: r.testIds } }).select('title topic difficulty isPublished questionCount');
  res.json({ jobRole: r, tests });
}));

// Invite candidates by email (they register/login as students to take the test)
router.post('/:id/invite', asyncHandler(async (req, res) => {
  const r = await mine(req, res); if (!r) return;
  const emails = [].concat(req.body?.emails || []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e));
  if (!emails.length) return res.status(400).json({ message: 'Provide at least one valid email' });
  await JobRole.updateOne({ _id: r._id }, { $addToSet: { invitedEmails: { $each: emails } } });
  res.json({ invited: emails.length });
}));

router.post('/:id/tests', asyncHandler(async (req, res) => {
  const r = await mine(req, res); if (!r) return;
  const test = await Test.findOne({ _id: req.body?.testId, createdBy: req.user._id, kind: 'screening' });
  if (!test) return res.status(404).json({ message: 'Test not found' });
  if (!test.isPublished) return res.status(400).json({ message: 'Publish the test before attaching it' });
  await JobRole.updateOne({ _id: r._id }, { $addToSet: { testIds: test._id } });
  res.json({ ok: true });
}));

// Ranked results across the role's screening tests (best score per candidate)
router.get('/:id/results', asyncHandler(async (req, res) => {
  const r = await mine(req, res); if (!r) return;
  const [attempts, users] = await Promise.all([
    Attempt.find({ testId: { $in: r.testIds }, status: { $ne: 'in_progress' } }).populate('studentId', 'name email'),
    User.find({ email: { $in: r.invitedEmails }, role: 'student' }).select('name email'),
  ]);
  const invitedSet = new Set(r.invitedEmails);
  const best = new Map();
  for (const a of attempts) {
    const u = a.studentId;
    if (!u || !invitedSet.has(u.email)) continue;
    const prev = best.get(String(u._id));
    if (!prev || a.percentage > prev.percentage) {
      best.set(String(u._id), {
        attemptId: a._id, candidateId: u._id, name: u.name, email: u.email,
        score: a.score, total: a.total, percentage: a.percentage, submittedAt: a.submittedAt,
      });
    }
  }
  const ranked = rankCandidates([...best.values()]);
  const attemptedEmails = new Set(ranked.map((x) => x.email));
  const pending = r.invitedEmails.filter((e) => !attemptedEmails.has(e));
  res.json({ ranked, pending, registeredInvitees: users.length });
}));

module.exports = router;
