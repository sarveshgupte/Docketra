const mongoose = require('mongoose');

const productUpdateSchema = new mongoose.Schema({
  updateKey: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  content: {
    type: [String],
    default: [],
    validate: {
      validator: (items) => Array.isArray(items) && items.length >= 1 && items.length <= 5,
      message: 'content must contain between 1 and 5 bullet points',
    },
  },
  version: {
    type: String,
    trim: true,
    default: null,
  },
  isPublished: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
    trim: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

productUpdateSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('ProductUpdate', productUpdateSchema, 'product_updates');
