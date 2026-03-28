const mongoose = require('mongoose');
const { StorageValidationError } = require('../services/storage/errors/StorageErrors');

const storageConfigurationSchema = new mongoose.Schema(
  {
    firmId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['docketra_managed', 'google-drive', 's3'],
      required: true,
      default: 'docketra_managed',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    rootFolderId: {
      type: String,
      trim: true,
    },
    driveId: {
      type: String,
      trim: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

storageConfigurationSchema.index(
  { firmId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

storageConfigurationSchema.pre('save', function validateStorageConfig(next) {
  try {
    if (this.provider === 'google-drive' && !this.credentials?.googleRefreshToken) {
      throw new StorageValidationError('Missing Google Drive refresh token');
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('StorageConfiguration', storageConfigurationSchema);
