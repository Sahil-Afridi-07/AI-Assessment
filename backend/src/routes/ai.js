// Preview AI questions for teachers/companies before saving them in a test.
const router = require('express').Router();
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const ai = require('../services/aiService');

router.post('/questions', protect, requireRole('teacher', 'company'), asyncHandler(async (req, res) => {
  const { topic, difficulty = 'medium', count = 5 } = req.body || {};
  if (!topic || !String(topic).trim()) return res.status(400).json({ message: 'Topic is required' });
  const questions = await ai.generateQuestions({ topic: String(topic).trim(), difficulty, count });
  res.json({ questions });
}));

module.exports = router;
