const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'medium' },
    source: { type: String, enum: ['AI', 'Manual', 'Mixed'], default: 'Manual' },
    // practice = student self-test, class = teacher test, screening = company test
    kind: { type: String, enum: ['practice', 'class', 'screening'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
    questionCount: { type: Number, default: 0 },
    // Practice generator settings (subjects, topics, custom subtopics, per-subject counts). Null for legacy tests.
    config: { type: mongoose.Schema.Types.Mixed, default: null },
    // Total allowed time in seconds. 0 = untimed (legacy / teacher / company tests).
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
