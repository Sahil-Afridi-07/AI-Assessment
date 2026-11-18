const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, protect } = require('../middleware/auth');

const sign = (u) =>
  jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ message: 'All fields are required' });
  if (!['student', 'teacher', 'company'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (await User.exists({ email: String(email).toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ token: sign(user), user: user.toSafe() });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  res.json({ token: sign(user), user: user.toSafe() });
}));

router.get('/me', protect, (req, res) => res.json({ user: req.user.toSafe() }));

module.exports = router;
