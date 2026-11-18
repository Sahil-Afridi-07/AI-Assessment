const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'company'], required: true },
    // Stored preferences only - the app does not send emails yet.
    preferences: {
      emailOnResult: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false },
      practiceReminders: { type: Boolean, default: false },
    },
    // Tokens issued before this moment are rejected (set on password change).
    lastPasswordChangeAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toSafe = function () {
  return { id: this._id, name: this.name, email: this.email, role: this.role, preferences: this.preferences };
};

module.exports = mongoose.model('User', userSchema);
