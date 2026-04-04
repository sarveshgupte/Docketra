const mongoose = require('mongoose');

const docketAttachmentMetadataSchema = new mongoose.Schema(
  {
    docketId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    firmId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    storageProvider: {
      type: String,
      enum: ['google_drive', 's3', 'dropbox'],
      required: true,
    },
    storageConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FirmStorageConfig',
      required: true,
      index: true,
    },
    fileId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
    collection: 'attachments',
  }
);

module.exports = mongoose.model('DocketAttachmentMetadata', docketAttachmentMetadataSchema);
