const jwt = require('jsonwebtoken');
const User = require('../models/User');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  const user = await User.findById(payload.id);
  if (!user) return res.status(401).json({ message: 'User no longer exists' });
  // Tokens issued before a password change are no longer valid
  if (user.lastPasswordChangeAt && payload.iat < Math.floor(user.lastPasswordChangeAt.getTime() / 1000)) {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
  req.user = user;
  next();
});

// Role-based access control guard
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this resource' });
  }
  next();
};

module.exports = { asyncHandler, protect, requireRole };
