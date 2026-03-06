const mongoose = require('mongoose');

/**
 * TemporarySignup Model
 * 
 * Stores temporary signup data during the self-serve registration flow.
 * Documents auto-delete after 15 minutes via TTL index.
 * 
 * Supports:
 * - Manual signup with email OTP verification
 */

const temporarySignupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true,
  },

  firmName: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true,
  },

  passwordHash: {
    type: String,
    default: null,
  },

  phone: {
    type: String,
    default: null,
    trim: true,
  },

  provider: {
    type: String,
    enum: ['manual'],
    required: true,
    default: 'manual',
  },

  otpHash: {
    type: String,
    default: null,
  },

  otpExpiresAt: {
    type: Date,
    default: null,
  },

  // Backward-compatibility field retained for legacy reads.
  otpExpiry: {
    type: Date,
    default: null,
  },

  otpAttempts: {
    type: Number,
    default: 0,
  },

  attemptCount: {
    type: Number,
    default: 0,
  },

  // Snake_case compatibility for external contracts.
  attempt_count: {
    type: Number,
    default: 0,
  },

  otpBlockedUntil: {
    type: Date,
    default: null,
  },

  otpResendCount: {
    type: Number,
    default: 0,
  },

  // Backward-compatibility field retained for legacy reads.
  resendCount: {
    type: Number,
    default: 0,
  },

  otpLastSentAt: {
    type: Date,
    default: null,
  },

  // Backward-compatibility field retained for legacy reads.
  lastOtpSentAt: {
    type: Date,
    default: null,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  consumedAt: {
    type: Date,
    default: null,
  },

  // Snake_case compatibility for external contracts.
  consumed_at: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // TTL: auto-delete after 15 minutes (900 seconds)
  },
});

module.exports = mongoose.model('TemporarySignup', temporarySignupSchema);
