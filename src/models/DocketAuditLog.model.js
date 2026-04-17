const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema({
  field: { type: String, required: true, trim: true },
  from: { type: mongoose.Schema.Types.Mixed, default: null },
  to: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

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
  requestId: {
    type: String,
    trim: true,
    default: () => randomUUID(),
    index: true,
  },
  tenantId: {
    type: String,
    trim: true,
    index: true,
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
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true,
  },
  performedByRole: {
    type: String,
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SYSTEM'],
    default: 'USER',
    index: true,
  },
  comment: {
    type: String,
    default: null,
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
  firmId: {
    type: String,
    required: true,
    index: true,
  },
}, {
  collection: 'docket_audit_logs',
  versionKey: false,
});

docketAuditLogSchema.pre('validate', function normalizeAuditFields(next) {
  if (!this.tenantId && this.firmId) this.tenantId = this.firmId;
  if (!this.firmId && this.tenantId) this.firmId = this.tenantId;

  if (this.performedBy && typeof this.performedBy === 'object' && !Array.isArray(this.performedBy)) {
    const userId = String(this.performedBy.userId || this.performedBy.xID || this.performedBy.id || 'SYSTEM').toUpperCase();
    const role = String(this.performedBy.role || 'USER').toUpperCase().replace('SUPERADMIN', 'SUPER_ADMIN');
    this.performedBy = userId;
    this.performedByRole = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SYSTEM'].includes(role) ? role : 'USER';
  } else {
    this.performedBy = String(this.performedBy || 'SYSTEM').toUpperCase();
  }

  next();
});

docketAuditLogSchema.index({ firmId: 1, docketId: 1, timestamp: -1 });
docketAuditLogSchema.index({ tenantId: 1, docketId: 1, timestamp: -1 });
docketAuditLogSchema.index(
  { firmId: 1, docketId: 1, action: 1, requestId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
    name: 'uniq_docket_audit_dedupe',
  },
);

module.exports = mongoose.models.DocketAuditLog || mongoose.model('DocketAuditLog', docketAuditLogSchema);
