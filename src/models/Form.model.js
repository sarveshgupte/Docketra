const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Field key is required'],
    trim: true,
  },
  label: {
    type: String,
    trim: true,
    default: '',
  },
  type: {
    type: String,
    enum: ['text', 'email', 'phone'],
    default: 'text',
  },
  required: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const formSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Form name is required'],
    trim: true,
  },
  fields: {
    type: [formFieldSchema],
    default: () => [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'phone' },
    ],
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  allowEmbed: {
    type: Boolean,
    default: true,
  },
  embedTitle: {
    type: String,
    trim: true,
    default: '',
  },
  successMessage: {
    type: String,
    trim: true,
    default: 'Thank you. Your submission has been received.',
  },
  redirectUrl: {
    type: String,
    trim: true,
    default: '',
  },
  themeMode: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light',
  },
  allowedEmbedDomains: {
    type: [String],
    default: [],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

formSchema.index({ firmId: 1, createdAt: -1 });

module.exports = mongoose.model('Form', formSchema);
