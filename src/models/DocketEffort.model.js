const mongoose = require('mongoose');

const docketEffortSchema = new mongoose.Schema(
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
    userXID: {
      type: String,
      uppercase: true,
      trim: true,
      required: [true, 'User XID is required'],
      index: true,
    },
    userEmail: {
      type: String,
      required: [true, 'User email is required'],
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    minutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [1, 'Minutes must be at least 1'],
    },
    activityType: {
      type: String,
      required: [true, 'Activity type is required'],
      enum: ['filing', 'review', 'communication', 'data_entry', 'reconciliation', 'other'],
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
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
docketEffortSchema.pre('validate', function () {
  if (this.firmId && !this.tenantId) {
    this.tenantId = String(this.firmId);
  } else if (this.tenantId && !this.firmId) {
    this.firmId = new mongoose.Types.ObjectId(this.tenantId);
  }
});

// Indexes for analytical groupings
docketEffortSchema.index({ tenantId: 1, userXID: 1 });
docketEffortSchema.index({ tenantId: 1, clientId: 1 });
docketEffortSchema.index({ caseInternalId: 1 });

module.exports = mongoose.model('DocketEffort', docketEffortSchema);
