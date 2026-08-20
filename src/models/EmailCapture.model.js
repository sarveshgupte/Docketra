const mongoose = require('mongoose');

const emailCaptureSchema = new mongoose.Schema(
  {
    // Organization/Tenant context references
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: [true, 'Firm ID is required'],
      index: true,
    },
    tenantId: {
      type: String,
      required: [true, 'Tenant ID is required'],
      index: true,
      trim: true,
    },
    sender: {
      email: {
        type: String,
        required: [true, 'Sender email is required'],
        lowercase: true,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
      },
    },
    recipients: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    receivedAt: {
      type: Date,
      required: [true, 'Received date is required'],
      default: Date.now,
    },
    bodyExcerpt: {
      type: String,
      trim: true,
      maxlength: [2000, 'Body excerpt cannot exceed 2000 characters'],
    },
    attachments: [
      {
        _id: false,
        filename: { type: String, required: true },
        contentType: { type: String, default: null },
        sizeBytes: { type: Number, default: 0 },
        storageUrl: { type: String, default: null },
      },
    ],
    // Linkages to clients and cases
    linkedClientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
      default: null,
    },
    linkedCaseId: {
      type: String,
      index: true,
      default: null,
    },
    linkedCaseInternalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      index: true,
      default: null,
    },
    // Message ID for webhook idempotency checks
    messageId: {
      type: String,
      index: true,
      default: null,
    },
    // Operational classification and follow-ups
    classification: {
      type: String,
      enum: ['actionable', 'awaiting_reply', 'reference_only'],
      default: 'actionable',
      index: true,
    },
    followUpDueDate: {
      type: Date,
      default: null,
    },
    ownerXID: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },
    createdByXID: {
      type: String,
      required: [true, 'Creator xID is required'],
      uppercase: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Keep firmId and tenantId in sync before validation
emailCaptureSchema.pre('validate', function() {
  if (this.firmId && !this.tenantId) {
    this.tenantId = String(this.firmId);
  } else if (this.tenantId && !this.firmId) {
    this.firmId = new mongoose.Types.ObjectId(this.tenantId);
  }
});

// Indices for operational performance and tenant boundary isolation
emailCaptureSchema.index({ tenantId: 1, linkedCaseInternalId: 1 });
emailCaptureSchema.index({ tenantId: 1, linkedClientId: 1 });
emailCaptureSchema.index({ tenantId: 1, classification: 1 });
emailCaptureSchema.index({ tenantId: 1, followUpDueDate: 1 });

module.exports = mongoose.model('EmailCapture', emailCaptureSchema);
