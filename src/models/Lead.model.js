const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['created', 'stage_changed', 'owner_changed', 'follow_up_updated', 'converted', 'lost', 'note_added'],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  actorXid: {
    type: String,
    default: null,
    uppercase: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const leadNoteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  createdByXid: {
    type: String,
    default: null,
    uppercase: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const leadSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Lead name is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
  },
  phone: {
    type: String,
    trim: true,
    default: null,
  },
  source: {
    type: String,
    trim: true,
    default: 'manual',
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new',
    index: true,
  },
  stage: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new',
    index: true,
  },
  ownerXid: {
    type: String,
    uppercase: true,
    trim: true,
    default: null,
    index: true,
  },
  nextFollowUpAt: {
    type: Date,
    default: null,
    index: true,
  },
  lastContactAt: {
    type: Date,
    default: null,
  },
  convertedAt: {
    type: Date,
    default: null,
  },
  convertedClientId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  lostReason: {
    type: String,
    trim: true,
    default: null,
  },
  linkedClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmClient',
    default: null,
    index: true,
  },
  notes: {
    type: [leadNoteSchema],
    default: [],
  },
  activitySummary: {
    type: [leadActivitySchema],
    default: [],
  },
  metadata: {
    utm_source: { type: String, default: null },
    utm_campaign: { type: String, default: null },
    utm_medium: { type: String, default: null },
    referrer: { type: String, default: null },
    pageUrl: { type: String, default: null },
    pageSlug: { type: String, default: null },
    formSlug: { type: String, default: null },
    formId: { type: String, default: null },
    service: { type: String, default: null },
    message: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    submissionMode: { type: String, default: null },
    externalSubmissionId: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    extraFields: { type: mongoose.Schema.Types.Mixed, default: null },
    intakeOutcome: {
      createdClient: { type: Boolean, default: false },
      createdDocket: { type: Boolean, default: false },
      clientId: { type: String, default: null },
      docketId: { type: String, default: null },
      source: { type: String, default: null },
      submissionMode: { type: String, default: null },
      formId: { type: String, default: null },
      formSlug: { type: String, default: null },
      autoCreateClientEnabled: { type: Boolean, default: false },
      autoCreateDocketEnabled: { type: Boolean, default: false },
      warnings: { type: [String], default: [] },
      updatedAt: { type: String, default: null },
    },
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

leadSchema.pre('validate', function syncStatusAndStage(next) {
  if (!this.stage && this.status) this.stage = this.status;
  if (!this.status && this.stage) this.status = this.stage;
  next();
});

leadSchema.index({ firmId: 1, status: 1, createdAt: -1 });
leadSchema.index({ firmId: 1, stage: 1, createdAt: -1 });
leadSchema.index({ firmId: 1, ownerXid: 1, createdAt: -1 });
leadSchema.index({ firmId: 1, stage: 1, nextFollowUpAt: 1 });

module.exports = mongoose.model('Lead', leadSchema);
