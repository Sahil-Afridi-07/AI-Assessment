// Student dashboard, performance analytics and reports. Every query is scoped to req.user.
const router = require('express').Router();
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const { asyncHandler, protect, requireRole } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const ai = require('../services/aiService');
const stats = require('../services/studentStats');
const { buildReport } = require('../services/report');
const { catalog } = require('../services/catalog');
const { isExpired, secondsRemaining } = require('../services/timing');

router.use(protect, requireRole('student'));

const FINAL = { $ne: 'in_progress' };

const finished = (studentId) =>
  Attempt.find({ studentId, status: FINAL }).sort({ submittedAt: -1 }).populate('testId', 'title difficulty').lean()
    .then((list) => list.map((a) => ({ ...a, title: a.testId?.title || 'Deleted test' })));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const attempts = await finished(req.user._id);
  const perf = stats.performance(attempts);

  const open = await Attempt.findOne({ studentId: req.user._id, status: 'in_progress' }).populate('testId', 'title').lean();
  const inProgress = open && !isExpired(open.deadlineAt)
    ? { attemptId: open._id, title: open.testId?.title, secondsRemaining: secondsRemaining(open.deadlineAt) }
    : null;

  res.json({
    ...stats.overview(attempts),
    recent: attempts.slice(0, 5).map((a) => ({
      attemptId: a._id, title: a.title, score: a.score, total: a.total, percentage: a.percentage, submittedAt: a.submittedAt, status: a.status,
    })),
    progress: stats.learningProgress(attempts),
    recommendedTopics: stats.recommendedTopics(perf.topics),
    inProgress,
  });
}));

router.get('/performance', asyncHandler(async (req, res) => {
  res.json(stats.performance(await finished(req.user._id)));
}));

// AI analysis built from the aggregated numbers above (falls back to a rule-based text).
router.post('/performance/analysis', asyncHandler(async (req, res) => {
  const attempts = await finished(req.user._id);
  if (!attempts.length) throw new AppError(400, 'Complete at least one assessment to get an analysis.', 'NO_DATA');
  const perf = stats.performance(attempts);
  const analysis = await ai.generatePerformanceAnalysis({
    attempts: perf.overview.totalAttempts, questions: perf.overview.totalQuestions,
    overallAccuracy: perf.overview.overallAccuracy, topics: perf.topics,
  });
  res.json({ ...analysis, basedOn: { attempts: perf.overview.totalAttempts, questions: perf.overview.totalQuestions } });
}));

const parseDate = (s, endOfDay) => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'Invalid date filter', 'BAD_DATE');
  if (endOfDay) d.setUTCHours(23, 59, 59, 999);
  return d;
};

router.get('/reports', asyncHandler(async (req, res) => {
  const { from, to, subject, topic, difficulty, status } = req.query;
  const q = { studentId: req.user._id, status: FINAL };
  if (status === 'submitted') q.status = { $in: ['submitted', null] };
  else if (status === 'auto_submitted') q.status = 'auto_submitted';
  else if (status) throw new AppError(400, 'Invalid status filter', 'BAD_FILTER');

  const f = parseDate(from, false); const t = parseDate(to, true);
  if (f || t) q.submittedAt = { ...(f && { $gte: f }), ...(t && { $lte: t }) };
  if (subject) q.subjects = String(subject);
  if (topic) q['topicBreakdown.topic'] = String(topic);
  if (difficulty) {
    if (!['easy', 'medium', 'hard'].includes(difficulty)) throw new AppError(400, 'Invalid difficulty filter', 'BAD_FILTER');
    q.difficulties = difficulty;
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [rows, total, all] = await Promise.all([
    Attempt.find(q).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('testId', 'title difficulty').lean(),
    Attempt.countDocuments(q),
    Attempt.find({ studentId: req.user._id, status: FINAL }).select('subjects topicBreakdown.topic').lean(),
  ]);

  res.json({
    page, limit, total,
    reports: rows.map((a) => ({
      _id: a._id, title: a.testId?.title || 'Deleted test', difficultyMode: a.testId?.difficulty || null,
      difficulties: a.difficulties || [],
      subjects: (a.subjects || []).map((id) => catalog.byId[id]?.name || id),
      topics: (a.topicBreakdown || []).map((x) => x.topic),
      total: a.total, correctCount: a.correctCount ?? a.score, incorrectCount: a.incorrectCount ?? null, score: a.score,
      percentage: a.percentage, timeTakenSec: a.timeTakenSec ?? null, status: a.status || 'submitted', submittedAt: a.submittedAt,
    })),
    // options for the filter dropdowns - only what this student has actually done
    filters: {
      subjects: [...new Set(all.flatMap((a) => a.subjects || []))].map((id) => ({ id, name: catalog.byId[id]?.name || id })),
      topics: [...new Set(all.flatMap((a) => (a.topicBreakdown || []).map((x) => x.topic)))].sort(),
    },
  });
}));

router.get('/reports/:id/pdf', asyncHandler(async (req, res) => {
  const attempt = await Attempt.findOne({ _id: req.params.id, studentId: req.user._id, status: FINAL });
  if (!attempt) throw new AppError(404, 'Report not found', 'NOT_FOUND');
  let PDFDocument;
  try { PDFDocument = require('pdfkit'); } catch { throw new AppError(501, 'PDF export is not available on this server.', 'NO_PDF'); }
  const test = await Test.findById(attempt.testId);
  const report = await buildReport(attempt, test);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="assessment-report-${attempt._id}.pdf"`);
  require('../services/pdfReport').renderReportPdf(PDFDocument, report, req.user.name, res);
}));

module.exports = router;
