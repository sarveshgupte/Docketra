const mongoose = require('mongoose');

/**
 * TemporarySignup Model
 * 
 * Stores temporary signup data during the self-serve registration flow.
 * Documents auto-delete after 15 minutes via TTL index.
 * 
 * Supports:
 * - Manual signup with email OTP verification
 * - Google OAuth signup (no OTP required)
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

  otpExpiry: {
    type: Date,
    default: null,
  },

  otpAttempts: {
    type: Number,
    default: 0,
  },

  resendCount: {
    type: Number,
    default: 0,
  },

  lastOtpSentAt: {
    type: Date,
    default: null,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // TTL: auto-delete after 15 minutes (900 seconds)
  },
});

module.exports = mongoose.model('TemporarySignup', temporarySignupSchema);
