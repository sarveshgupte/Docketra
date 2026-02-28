const mongoose = require('mongoose');

const tenantSlaConfigSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  caseType: {
    type: String,
    trim: true,
    default: null,
  },
  tatDurationMinutes: {
    type: Number,
    required: true,
    min: 1,
  },
  businessStartTime: {
    type: String,
    required: true,
    default: '10:00',
  },
  businessEndTime: {
    type: String,
    required: true,
    default: '18:00',
  },
  workingDays: {
    type: [Number],
    required: true,
    default: [1, 2, 3, 4, 5],
  },
  timezone: {
    type: String,
    required: true,
    default: 'UTC',
    trim: true,
  },
}, {
  timestamps: true,
});

tenantSlaConfigSchema.index({ firmId: 1, caseType: 1 }, { unique: true });

module.exports = mongoose.model('TenantSlaConfig', tenantSlaConfigSchema);
