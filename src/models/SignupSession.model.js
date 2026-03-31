const mongoose = require('mongoose');

const signupSessionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  firmName: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, required: true, trim: true },
  provider: { type: String, enum: ['manual'], default: 'manual', required: true },
  otpHash: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  attemptCount: { type: Number, default: 0, alias: 'attempt_count' },
  otpBlockedUntil: { type: Date, default: null },
  otpResendCount: { type: Number, default: 0 },
  otpLastSentAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null, alias: 'consumed_at' },
  createdAt: { type: Date, default: Date.now, expires: 900 },
});

module.exports = mongoose.model('SignupSession', signupSessionSchema);
