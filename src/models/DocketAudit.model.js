const mongoose = require('mongoose');

const docketAuditSchema = new mongoose.Schema({
  entityType: { type: String, required: true, default: 'docket', index: true },
  entityId: { type: String, required: true, index: true },
  docketId: { type: String, required: true, index: true },
  firmId: { type: String, required: true, index: true },

  event: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },

  userId: { type: String },
  userRole: { type: String },
  actorId: { type: String, index: true },
  actorRole: { type: String, index: true },

  fromState: { type: String },
  toState: { type: String },
  reasonCode: { type: String, default: null, index: true },

  qcOutcome: { type: String },

  dedupeKey: { type: String, index: true },

  metadata: { type: Object },

  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

docketAuditSchema.pre('validate', function normalizeCanonicalAudit(next) {
  if (!this.entityType) this.entityType = 'docket';
  if (!this.entityId) this.entityId = this.docketId;
  if (!this.action) this.action = this.event;
  if (!this.actorId) this.actorId = this.userId;
  if (!this.actorRole) this.actorRole = this.userRole;
  next();
});

docketAuditSchema.index({ firmId: 1, entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.models.DocketAudit || mongoose.model('DocketAudit', docketAuditSchema);
