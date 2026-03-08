const mongoose = require('mongoose');

/**
 * Firm-scoped Work Type master
 * Admin-managed taxonomy used during case creation.
 */
const workTypeSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
    immutable: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  /**
   * Docket ID prefix for this work type.
   * Format: 2-4 uppercase letters (e.g. "CO", "TAX", "CORP").
   * Used to generate human-readable docket IDs: PREFIX+YYYYMMDD+RANDOM
   * Must be unique within the firm.
   */
  prefix: {
    type: String,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 4,
    match: [/^[A-Z]{2,4}$/, 'Prefix must be 2-4 uppercase letters'],
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  tatDays: {
    type: Number,
    min: 0,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdByXID: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
}, { timestamps: true });

workTypeSchema.index({ firmId: 1, name: 1 }, { unique: true });
workTypeSchema.index({ firmId: 1, prefix: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WorkType', workTypeSchema);
