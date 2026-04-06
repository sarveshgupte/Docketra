const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['ASSIGNED', 'REASSIGNED', 'DOCKET_ACTIVATED', 'LIFECYCLE_CHANGED'],
    index: true,
  },
  docketId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  actor: {
    xID: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: false,
});

notificationSchema.index({ firmId: 1, userId: 1, timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
