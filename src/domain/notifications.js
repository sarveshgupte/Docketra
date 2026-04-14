const {
  NotificationTypes: ServiceNotificationTypes,
  createNotification: createNotificationEntry,
} = require('../services/notification.service');
const { enqueueNotificationJob } = require('../queues/notification.queue');
const log = require('../utils/log');

const NotificationTypes = Object.freeze({
  ASSIGNED: ServiceNotificationTypes.DOCKET_ASSIGNED,
  REASSIGNED: ServiceNotificationTypes.DOCKET_REASSIGNED,
  DOCKET_ACTIVATED: ServiceNotificationTypes.STATUS_CHANGED,
  LIFECYCLE_CHANGED: ServiceNotificationTypes.STATUS_CHANGED,
  CLIENT_UPLOAD: ServiceNotificationTypes.CLIENT_UPLOAD,
  DOCKET_ASSIGNED: ServiceNotificationTypes.DOCKET_ASSIGNED,
  DOCKET_REASSIGNED: ServiceNotificationTypes.DOCKET_REASSIGNED,
  STATUS_CHANGED: ServiceNotificationTypes.STATUS_CHANGED,
  COMMENT_ADDED: ServiceNotificationTypes.COMMENT_ADDED,
});

function buildMessage({ type, docketId, actor }) {
  const actorLabel = String(actor?.xID || actor?.name || 'A user').trim();
  if (type === NotificationTypes.DOCKET_ASSIGNED) {
    return {
      title: 'Docket assigned',
      message: `${actorLabel} assigned docket ${docketId} to you.`,
    };
  }
  if (type === NotificationTypes.DOCKET_REASSIGNED) {
    return {
      title: 'Docket reassigned',
      message: `${actorLabel} reassigned docket ${docketId}.`,
    };
  }
  if (type === NotificationTypes.COMMENT_ADDED) {
    return {
      title: 'New comment',
      message: `${actorLabel} added a comment on docket ${docketId}.`,
    };
  }
  if (type === NotificationTypes.CLIENT_UPLOAD) {
    return {
      title: 'Client upload',
      message: `${actorLabel} uploaded documents.`,
    };
  }
  return {
    title: 'Docket status changed',
    message: `${actorLabel} updated docket ${docketId}.`,
  };
}

function dispatchNotification(notificationPayload) {
  Promise.resolve(enqueueNotificationJob(notificationPayload))
    .then((result) => {
      if (result?.queued) {
        return result;
      }

      return createNotificationEntry(notificationPayload);
    })
    .catch((error) => {
      log.warn('NOTIFICATION_JOB_DISPATCH_FAILED', {
        error: error.message,
        userId: notificationPayload.userId,
        type: notificationPayload.type,
      });
      return createNotificationEntry(notificationPayload);
    })
    .catch((error) => {
      log.error('NOTIFICATION_JOB_FAILED', {
        error: error.message,
        userId: notificationPayload.userId,
        type: notificationPayload.type,
      });
    });
}

function createNotification(payload = {}) {
  const mappedType = NotificationTypes[payload.type] || payload.type;
  const content = buildMessage({ type: mappedType, docketId: payload.docketId, actor: payload.actor });

  const notificationPayload = {
    firmId: payload.firmId,
    userId: payload.userId,
    type: mappedType,
    docketId: payload.docketId,
    title: payload.title || content.title,
    message: payload.message || content.message,
    createdAt: payload.timestamp || payload.createdAt || new Date(),
    group: payload.group,
    emailEnabled: payload.emailEnabled,
  };

  dispatchNotification(notificationPayload);
  return notificationPayload;
}

module.exports = { NotificationTypes, createNotification };
