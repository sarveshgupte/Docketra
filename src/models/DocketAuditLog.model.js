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
  performedBy: {
    type: String,
    required: true,
    index: true,
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

module.exports = mongoose.models.DocketAuditLog || mongoose.model('DocketAuditLog', docketAuditLogSchema);
