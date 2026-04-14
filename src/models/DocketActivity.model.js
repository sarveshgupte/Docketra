const mongoose = require('mongoose');

const ACTIVITY_TYPES = Object.freeze([
  'DOCKET_CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'WORKBASKET_CHANGED',
  'PRIORITY_CHANGED',
  'COMMENT_ADDED',
  'UPDATED',
]);

const docketActivitySchema = new mongoose.Schema({
  docketId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  firmId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  description: { type: String, trim: true, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  performedByXID: { type: String, trim: true, uppercase: true },
  createdAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
});

docketActivitySchema.index({ docketId: 1, createdAt: -1 });
docketActivitySchema.index({ firmId: 1, docketId: 1 });

module.exports = {
  DocketActivity: mongoose.model('DocketActivity', docketActivitySchema),
  DOCKET_ACTIVITY_TYPES: ACTIVITY_TYPES,
};
