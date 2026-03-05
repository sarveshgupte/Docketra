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

module.exports = mongoose.model('WorkType', workTypeSchema);
