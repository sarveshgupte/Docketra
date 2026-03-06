const mongoose = require('mongoose');

const tenantMetricsSchema = new mongoose.Schema(
  {
    firmId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    users: {
      type: Number,
      default: 0,
      min: 0,
    },
    clients: {
      type: Number,
      default: 0,
      min: 0,
    },
    cases: {
      type: Number,
      default: 0,
      min: 0,
    },
    categories: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TenantMetrics', tenantMetricsSchema);
