const mongoose = require('mongoose');

const earlyAccessRequestSchema = new mongoose.Schema(
  {
    firmName: { type: String, required: true, trim: true },
    practiceType: { type: String, enum: ['CA', 'CS', 'Law'], required: true },
    teamMembers: { type: Number, min: 1, required: true },
    currentWorkflowSystem: { type: String, required: true, trim: true },
    compliancePainPoint: { type: String, required: true, trim: true },
    goLiveTimeline: { type: String, required: true, trim: true },
    status: { type: String, enum: ['NEW', 'REVIEWED', 'CONTACTED', 'REJECTED'], default: 'NEW', index: true },
  },
  { timestamps: true }
);

earlyAccessRequestSchema.index({ createdAt: -1 });
earlyAccessRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EarlyAccessRequest', earlyAccessRequestSchema);
