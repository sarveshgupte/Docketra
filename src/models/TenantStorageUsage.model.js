const mongoose = require('mongoose');

const tenantStorageUsageSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  totalBytes: {
    type: Number,
    default: 0,
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('TenantStorageUsage', tenantStorageUsageSchema);
