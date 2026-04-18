const mongoose = require('mongoose');

const docketAuditSchema = new mongoose.Schema({
  docketId: { type: String, required: true, index: true },
  firmId: { type: String, required: true, index: true },

  event: { type: String, required: true, index: true },

  userId: { type: String },
  userRole: { type: String },

  fromState: { type: String },
  toState: { type: String },

  qcOutcome: { type: String },

  dedupeKey: { type: String, index: true },

  metadata: { type: Object },

  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.models.DocketAudit || mongoose.model('DocketAudit', docketAuditSchema);
