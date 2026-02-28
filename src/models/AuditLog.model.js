const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: [true, 'tenantId is required'],
    index: true,
    immutable: true,
  },
  entityType: {
    type: String,
    required: [true, 'entityType is required'],
    trim: true,
    maxlength: 50,
    immutable: true,
  },
  entityId: {
    type: String,
    required: [true, 'entityId is required'],
    immutable: true,
  },
  action: {
    type: String,
    required: [true, 'action is required'],
    trim: true,
    maxlength: 50,
    index: true,
    immutable: true,
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    immutable: true,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    immutable: true,
  },
  performedBy: {
    type: String,
    required: [true, 'performedBy is required'],
    immutable: true,
  },
  performedByRole: {
    type: String,
    default: null,
    immutable: true,
  },
  impersonatedBy: {
    type: String,
    default: null,
    immutable: true,
  },
  ipAddress: {
    type: String,
    required: [true, 'ipAddress is required'],
    immutable: true,
  },
  userAgent: {
    type: String,
    required: [true, 'userAgent is required'],
    immutable: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    immutable: true,
  },
  previousHash: {
    type: String,
    default: null,
    immutable: true,
  },
  currentHash: {
    type: String,
    default: null,
    immutable: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
}, {
  strict: true,
  timestamps: false,
});

auditLogSchema.pre('updateOne', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('updateMany', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('findOneAndUpdate', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('replaceOne', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('deleteOne', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('deleteMany', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('findOneAndDelete', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.pre('remove', function (next) {
  next(new Error('Audit logs are immutable'));
});

auditLogSchema.index({ tenantId: 1, entityId: 1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
