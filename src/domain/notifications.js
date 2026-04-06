const Notification = require('../models/Notification.model');

const NotificationTypes = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  DOCKET_ACTIVATED: 'DOCKET_ACTIVATED',
  LIFECYCLE_CHANGED: 'LIFECYCLE_CHANGED',
});

function normalizeActor(actor = {}) {
  return {
    xID: String(actor?.xID || actor?.userId || actor?.id || 'SYSTEM').toUpperCase(),
    role: String(actor?.role || 'SYSTEM').toUpperCase(),
  };
}

async function createNotification({
  firmId,
  userId,
  type,
  docketId,
  actor,
  timestamp = new Date(),
}) {
  if (!NotificationTypes[type]) {
    const error = new Error(`Unsupported notification type: ${type}`);
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }

  return Notification.create({
    firmId,
    userId: String(userId || '').toUpperCase(),
    type,
    docketId,
    actor: normalizeActor(actor),
    timestamp,
  });
}

module.exports = {
  NotificationTypes,
  createNotification,
};
