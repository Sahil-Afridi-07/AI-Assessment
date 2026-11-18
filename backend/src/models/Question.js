const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
  text: { type: String, required: true },
  options: {
    type: [String],
    validate: (v) => Array.isArray(v) && v.length === 4,
  },
  correctOption: { type: Number, min: 0, max: 3, required: true },
  topic: { type: String, default: 'General' },
  generatedBy: { type: String, enum: ['AI', 'Manual'], default: 'Manual' },
  order: { type: Number, default: 0 },
  subject: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  explanation: { type: String, default: '' },
  timeAllottedSec: { type: Number, default: 90 },
});

module.exports = mongoose.model('Question', questionSchema);
