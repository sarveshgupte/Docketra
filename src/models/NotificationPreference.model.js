const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  inApp: {
    type: Boolean,
    default: true,
  },
  email: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const notificationPreferenceSchema = new mongoose.Schema({
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
  defaultChannels: {
    type: channelSchema,
    default: () => ({ inApp: true, email: false }),
  },
  typeChannels: {
    type: Map,
    of: channelSchema,
    default: () => ({}),
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

notificationPreferenceSchema.pre('save', function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

notificationPreferenceSchema.index({ firmId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
