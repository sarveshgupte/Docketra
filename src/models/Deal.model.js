const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmClient',
    required: [true, 'Client is required'],
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Deal title is required'],
    trim: true,
  },
  stage: {
    type: String,
    enum: ['new', 'in_progress', 'completed'],
    default: 'new',
    index: true,
  },
  value: {
    type: Number,
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

dealSchema.index({ firmId: 1, stage: 1, createdAt: -1 });

module.exports = mongoose.model('Deal', dealSchema);
