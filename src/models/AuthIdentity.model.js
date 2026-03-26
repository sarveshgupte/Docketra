const mongoose = require('mongoose');

const authIdentitySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  provider: {
    type: String,
    enum: ['google', 'email'],
    required: true,
  },
  provider_id: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  password_hash: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, {
  strict: true,
});

authIdentitySchema.index({ provider: 1, provider_id: 1 }, { unique: true });
authIdentitySchema.index({ user_id: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('AuthIdentity', authIdentitySchema);
