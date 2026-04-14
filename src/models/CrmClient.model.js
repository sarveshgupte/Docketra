const mongoose = require('mongoose');

const crmClientSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['individual', 'company'],
    default: 'individual',
    index: true,
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
  tags: {
    type: [String],
    default: [],
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

crmClientSchema.index({ firmId: 1, createdAt: -1 });

module.exports = mongoose.model('CrmClient', crmClientSchema);
