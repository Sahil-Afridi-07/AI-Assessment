// Student AI practice: catalog + multi-subject / mixed-topic assessment generation.
const router = require('express').Router();
const Test = require('../models/Test');
const Question = require('../models/Question');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const ai = require('../services/aiService');
const msg = require('../services/messages');
const { catalog, publicCatalog } = require('../services/catalog');
const { validateRequest, checkSubtopics } = require('../services/inputValidation');
const { allocateCounts, dealDifficulties, totalDurationSeconds, secondsFor, countBy, MAX_QUESTIONS } = require('../services/allocation');

router.use(protect, requireRole('student'));

router.get('/catalog', (req, res) => res.json({ categories: publicCatalog(), maxQuestions: MAX_QUESTIONS }));

// Simple per-user limiter to protect the Gemini quota. In-memory (resets on restart).
const hits = new Map();
function limited(userId) {
  const windowMs = 10 * 60 * 1000;
  const max = Number(process.env.PRACTICE_RATE_LIMIT) || 8;
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(userId, recent); return true; }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

async function recentQuestionTexts(studentId) {
  const tests = await Test.find({ createdBy: studentId, kind: 'practice' }).sort({ createdAt: -1 }).limit(10).select('_id');
  if (!tests.length) return [];
  const qs = await Question.find({ testId: { $in: tests.map((t) => t._id) } }).limit(150).select('text');
  return qs.map((q) => q.text);
}

router.post('/generate', asyncHandler(async (req, res) => {
  // 1-2. structural validation
  const v = validateRequest(req.body);
  if (!v.ok) throw new AppError(400, v.error.message, v.error.code, { field: v.error.field });
  const { subjects, topics, customSubtopics, difficulty, totalQuestions, distribution } = v.value;

  // 3-4. custom subtopics: catalog match first, AI only for what the catalog cannot decide
  for (const id of subjects) {
    if (!customSubtopics[id].length) continue;
    const rejected = await checkSubtopics(id, customSubtopics[id], ai.checkRelevance);
    if (rejected.length) {
      throw new AppError(422, msg.invalidTopic(catalog.byId[id].name), 'INVALID_TOPIC', {
        field: 'customSubtopics', subject: id, rejected: rejected.map((r) => r.subtopic),
      });
    }
  }

  const alloc = allocateCounts(subjects, totalQuestions, distribution);
  if (!alloc.ok) throw new AppError(400, msg.BAD_COUNT, 'BAD_COUNT', { field: 'totalQuestions' });

  if (limited(String(req.user._id))) throw new AppError(429, msg.RATE_LIMIT, 'RATE_LIMIT');

  const plan = dealDifficulties(alloc.counts, difficulty);
  const avoid = await recentQuestionTexts(req.user._id);

  // 5. generate each subject separately so a failure is isolated and every question stays on-topic
  let sections;
  try {
    sections = await Promise.all(subjects.map((id) => ai.generateSection({
      subject: id, subjectName: catalog.byId[id].name,
      focus: [...topics[id], ...customSubtopics[id]],
      difficulties: plan[id], avoid,
    })));
  } catch (e) {
    if (e.code === 'NO_QUESTIONS') throw new AppError(422, msg.NO_QUESTIONS, 'NO_QUESTIONS');
    console.error('AI generation failed:', e.code || e.name); // code only - never log keys or provider bodies
    throw new AppError(503, msg.AI_FAILURE, 'AI_UNAVAILABLE');
  }
  const questions = sections.flat();
  if (questions.length !== totalQuestions) throw new AppError(422, msg.NO_QUESTIONS, 'NO_QUESTIONS');

  const durationSeconds = totalDurationSeconds(questions);
  const subjectNames = subjects.map((id) => catalog.byId[id].name);
  const test = await Test.create({
    title: subjectNames.length > 2 ? `${subjectNames.slice(0, 2).join(', ')} +${subjectNames.length - 2} more` : subjectNames.join(' & '),
    topic: subjectNames.join(', '), difficulty, source: 'AI', kind: 'practice',
    createdBy: req.user._id, isPublished: true, questionCount: questions.length, durationSeconds,
    config: { subjects, topics, customSubtopics, difficulty, totalQuestions, counts: alloc.counts },
  });
  await Question.insertMany(questions.map((q, i) => ({
    testId: test._id, text: q.text, options: q.options, correctOption: q.correctOption, topic: q.topic,
    subject: q.subject, difficulty: q.difficulty, explanation: q.explanation || '', generatedBy: 'AI',
    timeAllottedSec: secondsFor(q.difficulty), order: i,
  })));

  res.status(201).json({
    test,
    summary: {
      totalQuestions: questions.length, durationSeconds,
      byDifficulty: countBy(questions, 'difficulty'),
      bySubject: Object.fromEntries(subjects.map((id) => [catalog.byId[id].name, alloc.counts[id]])),
    },
  });
}));

module.exports = router;
