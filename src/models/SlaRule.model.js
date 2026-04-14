const mongoose = require('mongoose');

const slaRuleSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
    default: null,
  },
  subcategory: {
    type: String,
    trim: true,
    default: null,
  },
  workbasketId: {
    type: String,
    trim: true,
    default: null,
  },
  slaHours: {
    type: Number,
    required: true,
    min: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

slaRuleSchema.index({ firmId: 1, isActive: 1, subcategory: 1, category: 1, workbasketId: 1 });

module.exports = mongoose.models.SlaRule || mongoose.model('SlaRule', slaRuleSchema);
