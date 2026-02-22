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
      unique: true,
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
      enum: ['active', 'revoked'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FirmStorage', firmStorageSchema);
