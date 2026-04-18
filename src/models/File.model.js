const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    caseId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    objectKey: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'AVAILABLE', 'MISSING', 'FAILED', 'DELETED_BY_SYSTEM'],
      default: 'PENDING',
      index: true,
    },
    processing: {
      scanStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
      thumbnailStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
      metadataStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
      scanCompletedAt: { type: Date, default: null },
      thumbnailCompletedAt: { type: Date, default: null },
      metadataCompletedAt: { type: Date, default: null },
      metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

fileSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

fileSchema.pre('save', function(next) {
  for (const value of Object.values(this.toObject({ depopulate: true }))) {
    if (Buffer.isBuffer(value)) {
      return next(new Error('File metadata cannot include binary payloads'));
    }
  }
  return next();
});

module.exports = mongoose.model('File', fileSchema);
