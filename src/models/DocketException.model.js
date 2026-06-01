const mongoose = require('mongoose');

const docketExceptionSchema = new mongoose.Schema(
  {
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
    caseInternalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Linked docket is required'],
      index: true,
    },
    caseId: {
      type: String,
      trim: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
      default: null,
    },
    exceptionType: {
      type: String,
      required: [true, 'Exception type is required'],
      enum: [
        'portal_issue',
        'query_raised',
        'DSC_authorisation_pending',
        'client_delay',
        'payment_pending',
        'data_mismatch',
        'other',
      ],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    owner: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'monitoring', 'resolved', 'closed_no_action'],
      default: 'open',
      index: true,
    },
    evidenceAttachmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null,
    },
    ticketNumber: {
      type: String,
      trim: true,
    },
    revisedEta: {
      type: Date,
      default: null,
    },
    createdByXID: {
      type: String,
      uppercase: true,
      trim: true,
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Keep firmId and tenantId in sync before validation
docketExceptionSchema.pre('validate', function(next) {
  if (this.firmId && !this.tenantId) {
    this.tenantId = String(this.firmId);
  } else if (this.tenantId && !this.firmId) {
    this.firmId = new mongoose.Types.ObjectId(this.tenantId);
  }
  next();
});

// Indexes for robust querying
docketExceptionSchema.index({ tenantId: 1, status: 1 });
docketExceptionSchema.index({ tenantId: 1, clientId: 1 });
docketExceptionSchema.index({ caseInternalId: 1, status: 1 });

module.exports = mongoose.model('DocketException', docketExceptionSchema);
