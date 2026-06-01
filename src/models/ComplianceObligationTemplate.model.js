const mongoose = require('mongoose');

const templateChecklistItemSchema = new mongoose.Schema({
  _id: false,
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  required: { type: Boolean, default: true },
  dueOffsetDays: { type: Number, default: 0, min: -120, max: 120 },
  sortOrder: { type: Number, min: 0, default: 0 },
});

const sopLinkSchema = new mongoose.Schema({
  _id: false,
  id: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  type: { type: String, enum: ['portal', 'reference', 'template', 'internal', 'other'], default: 'reference' },
  sortOrder: { type: Number, min: 0, default: 0 },
});

const complianceObligationTemplateSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180,
  },
  obligationType: {
    type: String,
    enum: ['GST', 'TDS', 'ROC', 'ANNUAL_FILING', 'OTHER'],
    required: true,
    default: 'OTHER',
    index: true,
  },
  applicableEntityTypes: {
    type: [String],
    default: [],
  },
  recurrencePattern: {
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      required: true,
      default: 'monthly',
    },
    interval: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
    },
    startMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
    },
  },
  dueDateRule: {
    mode: {
      type: String,
      enum: ['day_of_next_month', 'day_of_month_after_period', 'fixed_day_month'],
      default: 'day_of_next_month',
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28,
      default: 20,
    },
    monthOffset: {
      type: Number,
      min: 0,
      max: 24,
      default: 1,
    },
    fixedMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
  },
  internalBufferDays: {
    type: Number,
    min: 0,
    max: 120,
    default: 3,
  },
  defaultChecklist: {
    type: [templateChecklistItemSchema],
    default: [],
  },
  defaultSop: {
    title: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    format: { type: String, enum: ['plain_text', 'markdown'], default: 'markdown' },
    links: {
      type: [sopLinkSchema],
      default: [],
    },
  },
  defaultAssigneeXID: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  defaultReviewerXID: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  defaultApproverXID: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  docketCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  docketSubcategoryId: {
    type: String,
    trim: true,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isSample: {
    type: Boolean,
    default: false,
  },
  expectedMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  estimatedBudget: {
    type: Number,
    min: 0,
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  createdByXID: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  updatedByXID: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
}, {
  timestamps: true,
});

complianceObligationTemplateSchema.index({ firmId: 1, name: 1 }, { unique: true });
complianceObligationTemplateSchema.index({ firmId: 1, obligationType: 1, isActive: 1 });

module.exports = mongoose.model('ComplianceObligationTemplate', complianceObligationTemplateSchema);
