'use strict';

/**
 * CaseFile Model
 *
 * Staging record for async Google Drive file uploads.
 * Created by the upload controller immediately after receiving a file.
 * The storage worker processes the upload and updates this record.
 *
 * localPath — absolute path to the file on disk; never transmitted via Redis.
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
      required: true,
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
      enum: ['pending', 'uploaded', 'error'],
      default: 'pending',
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
      enum: ['upload', 'client_cfs'],
      default: 'upload',
    },
  },
  {
    timestamps: true,
  }
);

caseFileSchema.index({ firmId: 1, caseId: 1 });
caseFileSchema.index({ firmId: 1, checksum: 1 });

module.exports = mongoose.model('CaseFile', caseFileSchema);
