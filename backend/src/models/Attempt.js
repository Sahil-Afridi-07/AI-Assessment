const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: mongoose.Schema.Types.ObjectId,
    selected: { type: Number, default: null }, // ORIGINAL option index (server maps from the displayed index)
    marked: { type: Boolean, default: false }, // "mark for review"
    timeSpentSec: { type: Number, default: 0 }, // client-reported, clamped by the server
  },
  { _id: false }
);
const orderSchema = new mongoose.Schema(
  { questionId: mongoose.Schema.Types.ObjectId, order: [Number] }, // order[displayed] = original
  { _id: false }
);
const topicSchema = new mongoose.Schema({ topic: String, correct: Number, total: Number }, { _id: false });
const keyedSchema = new mongoose.Schema({ key: String, correct: Number, total: Number, timeSpentSec: Number }, { _id: false });

const attemptSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Legacy attempts have no status; they were always final, so default to 'submitted'.
    status: { type: String, enum: ['in_progress', 'submitted', 'auto_submitted'], default: 'submitted', index: true },
    startedAt: Date,
    deadlineAt: { type: Date, default: null }, // null = untimed
    durationSeconds: { type: Number, default: 0 },
    questionOrder: [mongoose.Schema.Types.ObjectId], // displayed order of questions
    optionOrders: [orderSchema],
    lastSavedAt: Date,

    answers: [answerSchema],
    score: Number,
    total: Number,
    percentage: Number,
    correctCount: Number,
    incorrectCount: Number,
    unansweredCount: Number,
    timeTakenSec: Number,
    topicBreakdown: [topicSchema],
    subjectBreakdown: [keyedSchema],
    difficultyBreakdown: [keyedSchema],
    // Denormalised for report filters
    subjects: [String],
    difficulties: [String],
    feedback: { type: String, default: '' },
    submittedAt: Date,
  },
  { timestamps: true }
);

attemptSchema.index({ studentId: 1, status: 1, submittedAt: -1 });

module.exports = mongoose.model('Attempt', attemptSchema);
