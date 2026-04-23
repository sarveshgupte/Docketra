'use strict';

/**
 * CaseFile Model
 *
 * Upload session + staging record.
 *
 * Legacy path: async worker upload from localPath.
 * BYOS path: direct-to-provider upload intents finalized by API.
 */

const mongoose = require('mongoose');

const caseFileSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    caseId: {
      type: String,
    },
    localPath: {
      type: String,
      default: null,
    },
    originalName: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    size: {
      type: Number,
    },
    storageFileId: {
      type: String,
      default: null,
    },
    uploadStatus: {
      type: String,
      enum: ['pending', 'initiated', 'uploaded', 'verified', 'error', 'failed', 'abandoned'],
      default: 'pending',
    },
    provider: {
      type: String,
      default: null,
    },
    providerMode: {
      type: String,
      enum: ['firm_connected', 'managed_fallback'],
      default: null,
    },
    providerFileId: {
      type: String,
      default: null,
    },
    providerObjectKey: {
      type: String,
      default: null,
    },
    targetFolderId: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    attachmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null,
    },
    cleanupAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    // Attachment metadata — stored here so the worker can create the Attachment record
    // after Drive upload without needing a second API round-trip.
    description: {
      type: String,
    },
    checksum: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    createdByXID: {
      type: String,
    },
    createdByName: {
      type: String,
    },
    note: {
      type: String,
    },
    clientId: {
      type: String,
    },
    source: {
      type: String,
      enum: ['upload', 'client_cfs', 'CLIENT_UPLOAD'],
      default: 'upload',
    },
  },
  {
    timestamps: true,
  }
);

caseFileSchema.index({ firmId: 1, caseId: 1 });
caseFileSchema.index({ firmId: 1, checksum: 1 });
caseFileSchema.index(
  { firmId: 1, attachmentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      attachmentId: { $type: 'objectId' },
    },
  }
);
caseFileSchema.index(
  { cleanupAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { cleanupAt: { $type: 'date' } } }
);

caseFileSchema.pre('save', function(next) {
  for (const value of Object.values(this.toObject({ depopulate: true }))) {
    if (Buffer.isBuffer(value)) {
      return next(new Error('CaseFile cannot persist binary payloads to MongoDB'));
    }
  }
  return next();
});

module.exports = mongoose.model('CaseFile', caseFileSchema);
