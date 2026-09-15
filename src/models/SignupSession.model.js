const mongoose = require('mongoose');

const legalConsentSchema = new mongoose.Schema({
  agreedToPilotTerms: { type: Boolean, required: true, default: false },
  agreedAt: { type: Date, required: true, default: Date.now },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  termsVersion: { type: String, required: true, default: 'v1.0_pilot_2026' },
  privacyVersion: { type: String, required: true, default: 'v1.0_pilot_2026' },
  agreementType: { type: String, default: 'PILOT_CLICKWRAP' },
}, { _id: false });

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
  legalConsent: { type: legalConsentSchema, default: null },
  createdAt: { type: Date, default: Date.now, expires: 900 },
});

module.exports = mongoose.model('SignupSession', signupSessionSchema);
