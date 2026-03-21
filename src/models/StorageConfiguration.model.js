const mongoose = require('mongoose');
const { StorageValidationError } = require('../storage/errors/StorageErrors');

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
      enum: ['google-drive'],
      required: true,
      default: 'google-drive',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    credentials: {
      googleRefreshToken: {
        type: String,
        trim: true,
        required: true,
      },
      connectedEmail: {
        type: String,
        trim: true,
      },
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

storageConfigurationSchema.pre('save', function validateGoogleOnlyConfig(next) {
  try {
    if (this.provider !== 'google-drive') {
      throw new StorageValidationError('Only google-drive provider is supported in this release');
    }
    if (!this.credentials?.googleRefreshToken) {
      throw new StorageValidationError('Missing Google Drive refresh token');
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('StorageConfiguration', storageConfigurationSchema);
