const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema(
  {
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    fileReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      required: [true, 'Attachment file reference is required'],
    },
    uploadedByXID: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    changeNote: {
      type: String,
      trim: true,
    },
    docketStageAtUpload: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const documentItemSchema = new mongoose.Schema(
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
      type: String, // Display caseId/caseNumber (e.g. "DCK-0001")
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Document category is required'],
      trim: true,
    },
    currentVersionNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'filed', 'archived'],
      default: 'draft',
      index: true,
    },
    uploadedByXID: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Sub-array representing the version history
    versions: {
      type: [documentVersionSchema],
      default: [],
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Keep firmId and tenantId in sync before validation
documentItemSchema.pre('validate', function() {
  if (this.firmId && !this.tenantId) {
    this.tenantId = String(this.firmId);
  } else if (this.tenantId && !this.firmId) {
    this.firmId = new mongoose.Types.ObjectId(this.tenantId);
  }
});

// Enforce unique naming constraint within a single case to prevent confusion
documentItemSchema.index({ caseInternalId: 1, name: 1 }, { unique: true });
documentItemSchema.index({ tenantId: 1, status: 1 });
documentItemSchema.index({ tenantId: 1, clientId: 1 });

module.exports = mongoose.model('DocumentItem', documentItemSchema);
