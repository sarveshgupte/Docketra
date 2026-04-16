const mongoose = require('mongoose');

const docketAuditLogSchema = new mongoose.Schema({
  docketId: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  fromState: {
    type: String,
    default: null,
  },
  toState: {
    type: String,
    default: null,
  },
  changes: {
    type: [{
      field: { type: String, required: true },
      from: { type: mongoose.Schema.Types.Mixed, default: null },
      to: { type: mongoose.Schema.Types.Mixed, default: null },
    }],
    default: [],
  },
  performedBy: {
    type: String,
    required: true,
    index: true,
  },
  performedByRole: {
    type: String,
    enum: ['USER', 'ADMIN', 'SYSTEM'],
    default: 'USER',
    index: true,
  },
  comment: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
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
  firmId: {
    type: String,
    required: true,
    index: true,
  },
}, {
  collection: 'docket_audit_logs',
  versionKey: false,
});

docketAuditLogSchema.index({ firmId: 1, docketId: 1, timestamp: -1 });
docketAuditLogSchema.index(
  { firmId: 1, docketId: 1, dedupeKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.DocketAuditLog || mongoose.model('DocketAuditLog', docketAuditLogSchema);
