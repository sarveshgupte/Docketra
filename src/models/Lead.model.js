const mongoose = require('mongoose');

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
    enum: ['new', 'contacted', 'converted'],
    default: 'new',
    index: true,
  },
  linkedClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmClient',
    default: null,
    index: true,
  },
  metadata: {
    utm_source: { type: String, default: null },
    utm_campaign: { type: String, default: null },
    referrer: { type: String, default: null },
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

leadSchema.index({ firmId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
