const mongoose = require('mongoose');

/**
 * Optional Sub Work Type linked to a parent Work Type.
 * Firm scope is duplicated for efficient authorization checks.
 */
const subWorkTypeSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
    immutable: true,
  },
  parentWorkTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkType',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
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

subWorkTypeSchema.index({ firmId: 1, parentWorkTypeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SubWorkType', subWorkTypeSchema);
