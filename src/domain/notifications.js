const log = require('../utils/log');
const {
  NotificationTypes: ServiceNotificationTypes,
  createNotification: createNotificationEntry,
} = require('../services/notification.service');
const { enqueueNotificationJob } = require('../queues/notification.queue');

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
  DOCKET_ROUTED_TO_WORKBASKET: ServiceNotificationTypes.DOCKET_ROUTED_TO_WORKBASKET,
  QC_RETURNED: ServiceNotificationTypes.QC_RETURNED,
  PENDED_DOCKET_REOPENED: ServiceNotificationTypes.PENDED_DOCKET_REOPENED,
  DOCKET_DUE_SOON: ServiceNotificationTypes.DOCKET_DUE_SOON,
  DOCKET_OVERDUE: ServiceNotificationTypes.DOCKET_OVERDUE,
});

function assertNotificationType(type) {
  if (!Object.values(ServiceNotificationTypes).includes(type)) {
    const error = new Error(`Unsupported notification type: ${type}`);
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }
}

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
  if (type === NotificationTypes.DOCKET_ROUTED_TO_WORKBASKET) {
    return { title: 'Docket routed', message: `Docket ${docketId} was routed to ${String(actor?.workbasketName || 'a Workbasket')}.` };
  }
  if (type === NotificationTypes.QC_RETURNED) {
    return { title: 'QC returned docket', message: `QC returned Docket ${docketId} for correction.` };
  }
  if (type === NotificationTypes.PENDED_DOCKET_REOPENED) {
    return { title: 'Pended docket reopened', message: `Pended Docket ${docketId} is back in your Worklist.` };
  }
  if (type === NotificationTypes.DOCKET_DUE_SOON) {
    return { title: 'Docket due soon', message: `Docket ${docketId} is due soon.` };
  }
  if (type === NotificationTypes.DOCKET_OVERDUE) {
    return { title: 'Docket overdue', message: `Docket ${docketId} is overdue.` };
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
  assertNotificationType(mappedType);
  const content = buildMessage({ type: mappedType, docketId: payload.docketId, actor: payload.actor });

  const notificationPayload = {
    firmId: payload.firmId,
    userId: payload.userId || payload.recipientXID,
    type: mappedType,
    docketId: payload.docketId,
    recipientUserId: payload.recipientUserId,
    recipientXID: payload.recipientXID || payload.userId,
    docketInternalId: payload.docketInternalId,
    workbasketId: payload.workbasketId,
    priority: payload.priority,
    metadata: payload.metadata,
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
