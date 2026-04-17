const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema({
  field: { type: String, required: true, trim: true },
  from: { type: mongoose.Schema.Types.Mixed, default: null },
  to: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const settingsAuditLogSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  tenantId: {
    type: String,
    trim: true,
    index: true,
  },
  requestId: {
    type: String,
    trim: true,
    default: () => randomUUID(),
    index: true,
  },
  category: {
    type: String,
    enum: ['roles', 'workflows', 'configs', 'integrations'],
    index: true,
    default: 'configs',
  },
  settingsKey: {
    type: String,
    trim: true,
    index: true,
    default: null,
  },
  action: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  entityType: {
    type: String,
    default: null,
  },
  entityId: {
    type: String,
    default: null,
  },
  performedBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true,
  },
  performedByRole: {
    type: String,
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SYSTEM'],
    default: 'ADMIN',
    index: true,
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

settingsAuditLogSchema.pre('validate', function normalizeAuditFields(next) {
  if (!this.tenantId && this.firmId) this.tenantId = this.firmId;
  if (!this.firmId && this.tenantId) this.firmId = this.tenantId;

  if (this.performedBy && typeof this.performedBy === 'object' && !Array.isArray(this.performedBy)) {
    const userId = String(this.performedBy.userId || this.performedBy.xID || this.performedBy.id || 'SYSTEM').toUpperCase();
    const role = String(this.performedBy.role || this.performedByRole || 'ADMIN').toUpperCase().replace('SUPERADMIN', 'SUPER_ADMIN');
    this.performedBy = userId;
    this.performedByRole = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SYSTEM'].includes(role) ? role : 'ADMIN';
  } else {
    this.performedBy = String(this.performedBy || 'SYSTEM').toUpperCase();
  }

  if (!this.settingsKey) this.settingsKey = this.category || 'configs';

  next();
});

settingsAuditLogSchema.index({ firmId: 1, category: 1, timestamp: -1 });
settingsAuditLogSchema.index({ tenantId: 1, settingsKey: 1, timestamp: -1 });
settingsAuditLogSchema.index(
  { firmId: 1, category: 1, action: 1, dedupeKey: 1 },
  { unique: true, sparse: true, name: 'uniq_settings_audit_legacy_dedupe' },
);
settingsAuditLogSchema.index(
  { tenantId: 1, settingsKey: 1, action: 1, requestId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
    name: 'uniq_settings_audit_request_dedupe',
  },
);

module.exports = mongoose.models.SettingsAuditLog || mongoose.model('SettingsAuditLog', settingsAuditLogSchema);
