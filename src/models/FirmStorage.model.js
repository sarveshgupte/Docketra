const mongoose = require('mongoose');

/**
 * FirmStorage Model
 *
 * Persists per-firm BYOS configuration.
 * Raw tokens MUST NOT be stored here — use encrypted variants only.
 */
const firmStorageSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    provider: {
      type: String,
      enum: ['google', 'onedrive', 'dropbox'],
      required: true,
    },
    encryptedAccessToken: {
      type: String,
    },
    encryptedRefreshToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
    rootFolderId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked', 'error'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

firmStorageSchema.index({ firmId: 1 }, { unique: true });

module.exports = mongoose.model('FirmStorage', firmStorageSchema);
