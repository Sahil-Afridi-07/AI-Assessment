const mongoose = require('mongoose');

const jobRoleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleName: { type: String, required: true, trim: true },
    invitedEmails: [{ type: String, lowercase: true, trim: true }],
    testIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobRole', jobRoleSchema);
