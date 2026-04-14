const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
    immutable: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    immutable: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
    immutable: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
    index: true,
    immutable: true,
    enum: [
      'HIERARCHY_UPDATED',
      'USER_INVITED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'ROLE_UPDATED',
    ],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    immutable: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    immutable: true,
  },
}, {
  strict: true,
  timestamps: false,
  versionKey: false,
});

adminAuditLogSchema.pre('updateOne', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.pre('updateMany', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.pre('deleteOne', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.pre('deleteMany', function(next) {
  next(new Error('Admin audit logs are immutable'));
});

adminAuditLogSchema.index({ firmId: 1, createdAt: -1 });
adminAuditLogSchema.index({ firmId: 1, action: 1, createdAt: -1 });
adminAuditLogSchema.index({ firmId: 1, actorId: 1, createdAt: -1 });
adminAuditLogSchema.index({ firmId: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);
