const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SYSTEM'],
    default: 'USER',
  },
}, { _id: false });

const changeSchema = new mongoose.Schema({
  field: { type: String, required: true, trim: true },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const settingsAuditLogSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  requestId: {
    type: String,
    required: true,
    trim: true,
    default: () => randomUUID(),
    index: true,
  },
  settingsKey: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  performedBy: {
    type: actorSchema,
    required: true,
  },
  changes: {
    type: [changeSchema],
    default: [],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  dedupeKey: {
    type: String,
    default: null,
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
}, {
  collection: 'settings_audit_logs',
  versionKey: false,
});

settingsAuditLogSchema.index({ tenantId: 1, settingsKey: 1, timestamp: -1 });
settingsAuditLogSchema.index(
  { tenantId: 1, settingsKey: 1, action: 1, requestId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
    name: 'uniq_settings_audit_dedupe',
  },
);

module.exports = mongoose.models.SettingsAuditLog || mongoose.model('SettingsAuditLog', settingsAuditLogSchema);
