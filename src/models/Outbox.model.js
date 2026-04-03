const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['EMAIL', 'NOTIFICATION'],
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {},
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'processed', 'failed'],
    default: 'pending',
    index: true,
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  requestId: {
    type: String,
    default: null,
    index: true,
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  errorMessage: {
    type: String,
    default: null,
  },
}, {
  strict: true,
  timestamps: { createdAt: true, updatedAt: false },
});

outboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

module.exports = mongoose.model('Outbox', outboxSchema);
