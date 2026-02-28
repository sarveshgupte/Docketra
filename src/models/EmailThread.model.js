const mongoose = require('mongoose');

const emailThreadSchema = new mongoose.Schema(
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
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    fromName: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: true,
    },
    bodyText: {
      type: String,
    },
    bodyHtml: {
      type: String,
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    strict: true,
    timestamps: false,
  }
);

emailThreadSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

module.exports = mongoose.model('EmailThread', emailThreadSchema);
