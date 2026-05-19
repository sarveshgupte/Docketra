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

subcategorySchema.pre('validate', function validateDeadlineRule(next) {
  const mode = this?.deadlineRule?.mode || 'NONE';
  const rule = this?.deadlineRule || {};
  if (mode === 'TAT_DAYS' && (!Number.isFinite(rule.tatDays) || Number(rule.tatDays) < 0)) {
    return next(new Error('deadlineRule.tatDays must be >= 0 for TAT_DAYS'));
  }
  if (mode === 'FIXED_DAY_NEXT_MONTH' && (!Number.isInteger(rule.fixedDayOfMonth) || rule.fixedDayOfMonth < 1 || rule.fixedDayOfMonth > 31)) {
    return next(new Error('deadlineRule.fixedDayOfMonth must be 1-31 for FIXED_DAY_NEXT_MONTH'));
  }
  if (mode === 'EVENT_DATE_OFFSET' && !Number.isFinite(rule.eventOffsetDays)) {
    return next(new Error('deadlineRule.eventOffsetDays is required for EVENT_DATE_OFFSET'));
  }
  return next();
});

categorySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Category', categorySchema);
