const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  feedbackId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    default: null,
    index: true,
  },
  firmName: {
    type: String,
    trim: true,
    default: null,
  },
  firmSlug: {
    type: String,
    trim: true,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  userXID: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
    trim: true,
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['BUG', 'FEEDBACK', 'ERROR', 'OTHER'],
    default: 'FEEDBACK',
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  pageUrl: {
    type: String,
    trim: true,
    default: null,
  },
  screenshot: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
    index: true,
  },
  response: {
    type: String,
    trim: true,
    default: null,
  },
  respondedAt: {
    type: Date,
    default: null,
  },
  respondedBy: {
    type: String,
    trim: true,
    default: null,
  },
  respondedByEmail: {
    type: String,
    trim: true,
    default: null,
  },
}, { timestamps: true });

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
