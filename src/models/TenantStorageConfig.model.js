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
      enum: ['aws_s3', 'azure_blob', 'gcs'],
      required: true,
    },
    encryptedCredentials: {
      type: String,
      required: true,
    },
    bucket: {
      type: String,
      required: true,
      trim: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    prefix: {
      type: String,
      default: '',
      trim: true,
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

tenantStorageConfigSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('TenantStorageConfig', tenantStorageConfigSchema);
