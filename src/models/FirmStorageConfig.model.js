const mongoose = require('mongoose');

const firmStorageConfigSchema = new mongoose.Schema(
  {
    firmId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['google_drive', 's3', 'dropbox'],
      required: true,
      default: 'google_drive',
    },
    encryptedAccessToken: {
      type: String,
      trim: true,
    },
    encryptedRefreshToken: {
      type: String,
      required: true,
      trim: true,
    },
    tokenExpiry: {
      type: Date,
      default: null,
    },
    rootFolderId: {
      type: String,
      trim: true,
      default: null,
    },
    driveId: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DISCONNECTED', 'QUOTA_EXCEEDED', 'ERROR'],
      default: 'ACTIVE',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'firm_storage_configs',
  }
);

firmStorageConfigSchema.index(
  { firmId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('FirmStorageConfig', firmStorageConfigSchema);
