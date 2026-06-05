const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/**
 * Category Model for Docketra Case Management System
 * 
 * Represents centralized case categories for organization and access control.
 * Admin-managed categories with nested subcategories for case classification.
 * 
 * Key Features:
 * - Unique category names
 * - Nested subcategories with unique names within each category
 * - Soft delete mechanism (isActive flag)
 * - Categories in use by cases cannot be deleted
 */



const SOP_LINK_TYPES = ['portal', 'reference', 'template', 'internal', 'other'];

const sopLinkSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  url: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2048,
    validate: {
      validator: (value) => /^https?:\/\//i.test(String(value || '')),
      message: 'SOP link url must be http or https',
    },
  },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  type: { type: String, enum: SOP_LINK_TYPES, default: 'reference' },
  sortOrder: { type: Number, min: 0 },
}, { _id: false });

const sopFileSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  fileName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, trim: true, maxlength: 255 },
  size: { type: Number, required: true, min: 0 },
  storageProvider: { type: String, required: true, trim: true, maxlength: 64 },
  storageFileId: { type: String, trim: true, default: null },
  objectKey: { type: String, trim: true, default: null },
  webViewLink: { type: String, trim: true, default: null, maxlength: 2048 },
  uploadedAt: { type: Date, default: Date.now },
  uploadedByXID: { type: String, trim: true, default: null },
  uploadedByName: { type: String, trim: true, default: null },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
  sortOrder: { type: Number, min: 0 },
}, { _id: false });

const subcategorySopSchema = new mongoose.Schema({
  title: { type: String, trim: true, maxlength: 200, default: '' },
  body: { type: String, maxlength: 10000, default: '' },
  format: { type: String, enum: ['plain_text', 'markdown'], default: 'plain_text' },
  lastUpdatedAt: { type: Date, default: null },
  lastUpdatedByXID: { type: String, trim: true, default: null },
  links: { type: [sopLinkSchema], default: [] },
  files: { type: [sopFileSchema], default: [] },
}, { _id: false });

const subcategorySchema = new mongoose.Schema({
  /**
   * Subcategory ID (auto-generated)
   */
  id: {
    type: String,
    required: true,
  },
  
  /**
   * Subcategory name
   * Must be unique within the parent category
   */
  name: {
    type: String,
    required: [true, 'Subcategory name is required'],
    trim: true,
  },
  workbasketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: [true, 'Workbasket required'],
  },
  
  /**
   * Soft delete mechanism for subcategories
   * When false, subcategory is considered deleted
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  defaultSlaDays: {
    type: Number,
    min: 0,
    default: 0,
  },
  forceQC: {
    type: Boolean,
    default: false,
  },
  employeeContextEnabled: {
    type: Boolean,
    default: false,
  },
  requiresRelatedEmployeeUser: {
    type: Boolean,
    default: false,
  },
  deadlineRule: {
    mode: {
      type: String,
      enum: ['NONE', 'TAT_DAYS', 'FIXED_DAY_NEXT_MONTH', 'MANUAL_DATE_REQUIRED', 'EVENT_DATE_OFFSET'],
      default: 'NONE',
    },
    tatDays: { type: Number, min: 0 },
    fixedDayOfMonth: { type: Number, min: 1, max: 31 },
    eventOffsetDays: { type: Number },
    label: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    allowManualOverride: { type: Boolean, default: true },
  },
  sop: {
    type: subcategorySopSchema,
    default: () => ({}),
  },
  checklistTemplate: {
    type: [{
      _id: false,
      id: { type: String, required: true, trim: true },
      title: { type: String, required: true, trim: true, maxlength: 200 },
      description: { type: String, trim: true, maxlength: 1000, default: '' },
      required: { type: Boolean, default: false },
      sortOrder: { type: Number, min: 0 },
      defaultAssigneeXID: { type: String, trim: true, default: null },
      dueOffsetDays: { type: Number, min: 0 },
    }],
    default: [],
  },
}, {
  _id: false, // Disable automatic _id generation for subdocuments
});

const categorySchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
  },

  /**
   * Category name
   * Required and unique to prevent duplicate categories
   * Used for case classification
   */
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
  },
  
  /**
   * Nested subcategories array
   * Subcategory names must be unique within the category
   */
  subcategories: {
    type: [subcategorySchema],
    default: [],
  },
  
  /**
   * Soft delete mechanism
   * When false, category is considered deleted without removing from database
   * Maintains data integrity and audit trail
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  defaultSlaDays: {
    type: Number,
    min: 0,
    default: 0,
  },
  forceQC: {
    type: Boolean,
    default: false,
  },
  employeeContextEnabled: {
    type: Boolean,
    default: false,
  },
  requiresRelatedEmployeeUser: {
    type: Boolean,
    default: false,
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Performance Indexes
 * 
 * - name: Unique index (automatic from schema definition) for fast lookups
 * - isActive: For filtering active vs inactive categories
 */
categorySchema.index({ isActive: 1 });
categorySchema.index({ firmId: 1, name: 1 }, { unique: true });

subcategorySchema.pre('validate', function validateDeadlineRule() {
  const mode = this?.deadlineRule?.mode || 'NONE';
  const rule = this?.deadlineRule || {};
  if (mode === 'TAT_DAYS' && (!Number.isFinite(rule.tatDays) || Number(rule.tatDays) < 0)) {
    throw new Error('deadlineRule.tatDays must be >= 0 for TAT_DAYS');
  }
  if (mode === 'FIXED_DAY_NEXT_MONTH' && (!Number.isInteger(rule.fixedDayOfMonth) || rule.fixedDayOfMonth < 1 || rule.fixedDayOfMonth > 31)) {
    throw new Error('deadlineRule.fixedDayOfMonth must be 1-31 for FIXED_DAY_NEXT_MONTH');
  }
  if (mode === 'EVENT_DATE_OFFSET' && !Number.isFinite(rule.eventOffsetDays)) {
    throw new Error('deadlineRule.eventOffsetDays is required for EVENT_DATE_OFFSET');
  }
  if (Array.isArray(this.checklistTemplate)) {
    this.checklistTemplate = this.checklistTemplate.map((item, index) => {
      const nextItem = item && typeof item.toObject === 'function' ? item.toObject() : { ...item };
      if (!Number.isFinite(nextItem.sortOrder)) nextItem.sortOrder = index;
      return nextItem;
    });
  }
});

categorySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Category', categorySchema);
