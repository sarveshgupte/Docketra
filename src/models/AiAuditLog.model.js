const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const aiAuditLogSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  requestId: {
    type: String,
    trim: true,
    default: () => randomUUID(),
    index: true,
  },
  featureName: {
    type: String,
    required: true,
    trim: true,
    enum: ['documentAnalysis', 'docketDrafting', 'routingSuggestions', 'other'],
    index: true,
  },
  provider: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    enum: ['openai', 'gemini', 'claude'],
    index: true,
  },
  model: {
    type: String,
    trim: true,
    default: null,
  },
  status: {
    type: String,
    required: true,
    enum: ['SUCCESS', 'FAILED'],
    index: true,
  },
  latencyMs: {
    type: Number,
    min: 0,
    default: 0,
  },
  tokenUsage: {
    inputTokens: { type: Number, min: 0, default: 0 },
    outputTokens: { type: Number, min: 0, default: 0 },
    totalTokens: { type: Number, min: 0, default: 0 },
  },
  error: {
    code: { type: String, default: null, trim: true },
    status: { type: Number, default: null },
    message: { type: String, default: null, trim: true },
    provider: { type: String, default: null, trim: true, lowercase: true },
  },
  verboseMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  collection: 'ai_audit_logs',
  versionKey: false,
  strict: true,
});

aiAuditLogSchema.index({ firmId: 1, featureName: 1, createdAt: -1 });
aiAuditLogSchema.index({ firmId: 1, requestId: 1, createdAt: -1 });
aiAuditLogSchema.index({ firmId: 1, provider: 1, model: 1, createdAt: -1 });

module.exports = mongoose.models.AiAuditLog || mongoose.model('AiAuditLog', aiAuditLogSchema);
