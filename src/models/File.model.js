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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

fileSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

module.exports = mongoose.model('File', fileSchema);
