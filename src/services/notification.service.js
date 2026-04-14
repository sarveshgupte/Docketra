const Notification = require('../models/Notification.model');

const NotificationTypes = Object.freeze({
  DOCKET_ASSIGNED: 'DOCKET_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  DOCKET_REASSIGNED: 'DOCKET_REASSIGNED',
  CLIENT_UPLOAD: 'CLIENT_UPLOAD',
  SLA_BREACHED: 'SLA_BREACHED',
});

const GROUPING_WINDOW_MS = 30 * 60 * 1000;

function assertType(type) {
  if (!Object.values(NotificationTypes).includes(type)) {
    const error = new Error(`Unsupported notification type: ${type}`);
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }
}

function normalizePayload(payload = {}) {
  const userId = String(payload.userId || '').toUpperCase().trim();
  const firmId = String(payload.firmId || '').trim();
  const type = String(payload.type || '').trim().toUpperCase();
  const docketId = payload.docketId ? String(payload.docketId).trim() : null;
  const title = String(payload.title || '').trim();
  const message = String(payload.message || '').trim();
  const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();

  if (!userId || !firmId || !type || !title || !message) {
    const error = new Error('firmId, userId, type, title and message are required');
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_PAYLOAD';
    throw error;
  }
  assertType(type);

  return {
    userId,
    firmId,
    type,
    title,
    message,
    docketId,
    createdAt,
    emailEnabled: Boolean(payload.emailEnabled),
  };
}

async function createNotification(payload) {
  const normalized = normalizePayload(payload);
  const groupingEnabled = payload?.group !== false;
  if (!groupingEnabled) {
    return Notification.create(normalized);
  }

  const createdAt = normalized.createdAt || new Date();
  const lowerBound = new Date(createdAt.getTime() - GROUPING_WINDOW_MS);
  const existing = await Notification.findOne({
    firmId: normalized.firmId,
    userId: normalized.userId,
    type: normalized.type,
    docketId: normalized.docketId,
    isRead: false,
    createdAt: { $gte: lowerBound },
  }).sort({ createdAt: -1 });

  if (!existing) {
    return Notification.create(normalized);
  }

  existing.groupCount = Number(existing.groupCount || 1) + 1;
  existing.title = normalized.title;
  existing.message = existing.groupCount > 1
    ? `${normalized.message} (${existing.groupCount} updates)`
    : normalized.message;
  existing.createdAt = createdAt;
  existing.isRead = false;
  await existing.save();
  return existing;
}

async function getUserNotifications(userId, firmId, options = {}) {
  const limit = options.limit ? Number(options.limit) : 25;
  return Notification.find({
    userId: String(userId || '').toUpperCase(),
    firmId: String(firmId || ''),
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(100, limit)))
    .lean();
}

async function markAsRead(notificationId, userId, firmId) {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId: String(userId || '').toUpperCase(),
      firmId: String(firmId || ''),
    },
    {
      $set: {
        isRead: true,
      },
    },
    { new: true },
  ).lean();
}

module.exports = {
  NotificationTypes,
  createNotification,
  getUserNotifications,
  markAsRead,
};
