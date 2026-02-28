const mongoose = require('mongoose');

const tenantCaseMetricsDailySchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  totalCases: { type: Number, default: 0, min: 0 },
  openCases: { type: Number, default: 0, min: 0 },
  pendedCases: { type: Number, default: 0, min: 0 },
  filedCases: { type: Number, default: 0, min: 0 },
  resolvedCases: { type: Number, default: 0, min: 0 },
  pendingApprovals: { type: Number, default: 0, min: 0 },
  overdueCases: { type: Number, default: 0, min: 0 },
  avgResolutionTimeSeconds: { type: Number, default: 0, min: 0 },
  casesCreatedToday: { type: Number, default: 0, min: 0 },
  casesResolvedToday: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
});

tenantCaseMetricsDailySchema.index({ tenantId: 1, date: 1 }, { unique: true });
tenantCaseMetricsDailySchema.index({ tenantId: 1, openCases: 1 });
tenantCaseMetricsDailySchema.index({ tenantId: 1, overdueCases: 1 });

module.exports = mongoose.model('TenantCaseMetricsDaily', tenantCaseMetricsDailySchema);
