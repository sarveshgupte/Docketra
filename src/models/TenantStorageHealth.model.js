const mongoose = require('mongoose');

const tenantStorageHealthSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'DISCONNECTED'],
      default: 'HEALTHY',
      required: true,
    },
    lastVerifiedAt: {
      type: Date,
    },
    missingFilesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sampleSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastError: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantStorageHealth', tenantStorageHealthSchema);
