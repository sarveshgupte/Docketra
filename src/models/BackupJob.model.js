const mongoose = require('mongoose');

const backupJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    firmId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    storageProvider: {
      type: String,
      trim: true,
      default: null,
    },
    archiveObjectKey: {
      type: String,
      required: true,
      trim: true,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'success', 'failed'],
      default: 'queued',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    emailNotification: {
      status: {
        type: String,
        enum: ['not_requested', 'pending', 'sent', 'failed'],
        default: 'not_requested',
      },
      recipients: {
        type: [String],
        default: [],
      },
      error: {
        type: String,
        default: null,
      },
      sentAt: {
        type: Date,
        default: null,
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

backupJobSchema.index({ firmId: 1, startedAt: -1 });

module.exports = mongoose.model('BackupJob', backupJobSchema);
