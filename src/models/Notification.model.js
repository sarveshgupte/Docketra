const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  user_id: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['DOCKET_ASSIGNED', 'DOCKET_ACTIVATED', 'DOCKET_COMPLETED'],
    index: true,
  },
  docket_id: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

notificationSchema.index({ firmId: 1, user_id: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
