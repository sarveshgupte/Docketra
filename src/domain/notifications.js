const Notification = require('../models/Notification.model');

const NotificationTypes = Object.freeze({
  DOCKET_ASSIGNED: 'DOCKET_ASSIGNED',
  DOCKET_ACTIVATED: 'DOCKET_ACTIVATED',
  DOCKET_COMPLETED: 'DOCKET_COMPLETED',
});

async function createNotification({
  firmId,
  user_id,
  type,
  docket_id,
  message,
  created_at = new Date(),
}) {
  if (!NotificationTypes[type]) {
    const error = new Error(`Unsupported notification type: ${type}`);
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }

  return Notification.create({
    firmId,
    user_id,
    type,
    docket_id,
    message,
    created_at,
  });
}

module.exports = {
  NotificationTypes,
  createNotification,
};
