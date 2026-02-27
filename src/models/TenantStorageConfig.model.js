const mongoose = require('mongoose');

const tenantStorageConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['google_drive', 'onedrive'],
      required: true,
    },
    encryptedRefreshToken: {
      type: String,
      required: true,
    },
    driveId: {
      type: String,
      trim: true,
    },
    rootFolderId: {
      type: String,
      trim: true,
    },
    connectedByUserId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DEGRADED', 'DISCONNECTED', 'QUOTA_EXCEEDED', 'ERROR'],
      default: 'ACTIVE',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

tenantStorageConfigSchema.index(
  { tenantId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('TenantStorageConfig', tenantStorageConfigSchema);
