const mongoose = require('mongoose');

const landingPageSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
    default: null,
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: [true, 'Form is required'],
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  headerText: {
    type: String,
    trim: true,
    default: null,
  },
  subText: {
    type: String,
    trim: true,
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

landingPageSchema.index({ firmId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('LandingPage', landingPageSchema);
