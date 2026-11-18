const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    testIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClassBatch', classSchema);
