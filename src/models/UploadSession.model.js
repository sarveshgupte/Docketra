const mongoose = require('mongoose');

const uploadSessionSchema = new mongoose.Schema({
  docketId: {
    type: String,
    required: true,
    index: true,
  },
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  pinHash: {
    type: String,
    default: null,
  },
  clientMessage: {
    type: String,
    default: null,
  },
  senderName: {
    type: String,
    default: null,
  },
  senderEmail: {
    type: String,
    default: null,
  },
  reopenAt: {
    type: Date,
    default: null,
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

uploadSessionSchema.index({ docketId: 1, firmId: 1, isActive: 1 });

module.exports = mongoose.model('UploadSession', uploadSessionSchema);
