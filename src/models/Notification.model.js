const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['DOCKET_ASSIGNED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'DOCKET_REASSIGNED', 'CLIENT_UPLOAD', 'SLA_BREACHED'],
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  docketId: {
    type: String,
    required: false,
    trim: true,
    index: true,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  groupCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  emailEnabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: false,
});

notificationSchema.virtual('read').get(function read() {
  return this.isRead;
});

notificationSchema.virtual('timestamp').get(function timestamp() {
  return this.createdAt;
});

notificationSchema.index({ firmId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ firmId: 1, userId: 1, type: 1, docketId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
