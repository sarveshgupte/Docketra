const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'storage_change'],
    required: true,
    index: true,
  },
  expires_at: {
    type: Date,
    required: true,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  is_used: {
    type: Boolean,
    default: false,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, {
  strict: true,
});

otpSchema.index({ identifier: 1, purpose: 1, created_at: -1 });

module.exports = mongoose.model('Otp', otpSchema);
