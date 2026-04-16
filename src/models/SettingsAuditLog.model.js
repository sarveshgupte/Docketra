const mongoose = require('mongoose');

const settingsAuditLogSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: ['roles', 'workflows', 'configs', 'integrations'],
    required: true,
    index: true,
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
    type: String,
    required: true,
    index: true,
  },
  performedByRole: {
    type: String,
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
    default: 'ADMIN',
    index: true,
  },
  changes: {
    type: [{
      field: { type: String, required: true },
      from: { type: mongoose.Schema.Types.Mixed, default: null },
      to: { type: mongoose.Schema.Types.Mixed, default: null },
    }],
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

settingsAuditLogSchema.index({ firmId: 1, category: 1, timestamp: -1 });
settingsAuditLogSchema.index(
  { firmId: 1, category: 1, action: 1, dedupeKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.SettingsAuditLog || mongoose.model('SettingsAuditLog', settingsAuditLogSchema);
