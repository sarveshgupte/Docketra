const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const { enqueueEmailJob } = require('../queues/email.queue');
const { NotificationTypes } = require('../constants/notificationTypes');
const { emitUserNotification } = require('./notificationSocket.service');
const { resolveDeliveryChannels } = require('./notificationPreference.service');
const log = require('../utils/log');

const GROUPING_WINDOW_MS = 30 * 60 * 1000;

async function resolveRecipientXid(payload = {}, firmId = '') {
  const directXid = String(payload.recipientXID || payload.userId || '').toUpperCase().trim();
  if (directXid) return directXid;

  const recipientUserId = String(payload.recipientUserId || '').trim();
  if (!recipientUserId) return '';

  const recipient = await User.findOne({
    _id: recipientUserId,
    firmId,
    status: { $ne: 'deleted' }
  }).select('xID').lean();

  return String(recipient?.xID || '').toUpperCase().trim();
}

function assertType(type) {
  if (!Object.values(NotificationTypes).includes(type)) {
    const error = new Error(`Unsupported notification type: ${type}`);
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }
}

function normalizePayload(payload = {}) {
  const userId = String(payload.recipientXID || payload.userId || '').toUpperCase().trim();
  const firmId = String(payload.firmId || '').trim();
  const type = String(payload.type || '').trim().toUpperCase();
  const docketId = payload.docketId ? String(payload.docketId).trim() : null;
  const title = String(payload.title || '').trim();
  const message = String(payload.message || '').trim();
  const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();
  const docketInternalId = payload.docketInternalId ? String(payload.docketInternalId).trim() : null;
  const workbasketId = payload.workbasketId ? String(payload.workbasketId).trim() : null;
  const priority = String(payload.priority || 'NORMAL').toUpperCase();

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
    docketInternalId,
    workbasketId,
    priority,
    metadata: payload.metadata || null,
    createdAt,
    emailEnabled: Boolean(payload.emailEnabled),
  };
}

async function createNotification(payload) {
  try {
    if (!payload?.recipientUserId && !payload?.recipientXID && !payload?.userId) return null;
    const resolvedRecipientXid = await resolveRecipientXid(payload, String(payload?.firmId || '').trim());
    if (!resolvedRecipientXid) return null;
    const normalized = normalizePayload({ ...payload, recipientXID: resolvedRecipientXid });
    const recipient = await User.findOne({
      xID: normalized.userId,
      firmId: normalized.firmId,
      status: { $ne: 'deleted' }
    }).select('xID').lean();
    if (!recipient) return null;
  let deliveryChannels = { inApp: true, email: Boolean(payload?.emailEnabled) };
  try {
    deliveryChannels = await resolveDeliveryChannels({
      userId: normalized.userId,
      firmId: normalized.firmId,
      type: normalized.type,
      fallbackEmailEnabled: Boolean(payload?.emailEnabled),
    });
  } catch (_error) {
    deliveryChannels = { inApp: true, email: Boolean(payload?.emailEnabled) };
  }
  normalized.emailEnabled = Boolean(deliveryChannels.email);
  const groupingEnabled = payload?.group !== false;
  let notificationDoc = null;
  if (!groupingEnabled) {
    notificationDoc = await Notification.create(normalized);
  } else {
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
      notificationDoc = await Notification.create(normalized);
    } else {
      existing.groupCount = Number(existing.groupCount || 1) + 1;
      existing.title = normalized.title;
      existing.message = existing.groupCount > 1
        ? `${normalized.message} (${existing.groupCount} updates)`
        : normalized.message;
      existing.createdAt = createdAt;
      existing.isRead = false;
      existing.emailEnabled = normalized.emailEnabled;
      await existing.save();
      notificationDoc = existing;
    }
  }

  if (deliveryChannels.inApp !== false) {
    emitUserNotification({
      firmId: normalized.firmId,
      userId: normalized.userId,
      notification: notificationDoc,
    });
  }

  if (deliveryChannels.email) {
    await enqueueNotificationEmail(normalized, notificationDoc);
  }

  return notificationDoc;
  } catch (error) {
    log.warn('NOTIFICATION_CREATE_FAILED', { error: error?.message, type: payload?.type, docketId: payload?.docketId });
    return null;
  }
}

function toTextValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildNotificationEmail({ title, message, docketId, type, createdAt }) {
  const safeTitle = toTextValue(title) || 'Notification';
  const safeMessage = toTextValue(message) || 'A new update is available.';
  const safeType = toTextValue(type) || 'UPDATE';
  const safeDocketId = toTextValue(docketId);
  const safeTimestamp = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

  const subject = `[Docketra] ${safeTitle}`;
  const textLines = [
    safeMessage,
    '',
    `Type: ${safeType}`,
    safeDocketId ? `Case: ${safeDocketId}` : null,
    `When: ${safeTimestamp}`,
  ].filter(Boolean);
  const text = textLines.join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h3>${escapeHtml(safeTitle)}</h3>
      <p>${escapeHtml(safeMessage)}</p>
      <p style="color: #555; font-size: 14px;">
        <strong>Type:</strong> ${escapeHtml(safeType)}<br/>
        ${safeDocketId ? `<strong>Case:</strong> ${escapeHtml(safeDocketId)}<br/>` : ''}
        <strong>When:</strong> ${escapeHtml(safeTimestamp)}
      </p>
    </div>
  `;

  return { subject, text, html };
}

async function enqueueNotificationEmail(normalized, notificationDoc) {
  try {
    const user = await User.findOne({
      xID: normalized.userId,
      firmId: normalized.firmId,
    })
      .select('email')
      .lean();
    const to = toTextValue(user?.email).toLowerCase();
    if (!to) return;

    const { subject, text, html } = buildNotificationEmail({
      title: notificationDoc?.title || normalized.title,
      message: notificationDoc?.message || normalized.message,
      docketId: notificationDoc?.docketId || normalized.docketId,
      type: notificationDoc?.type || normalized.type,
      createdAt: notificationDoc?.createdAt || normalized.createdAt,
    });

    await enqueueEmailJob('sendEmail', {
      mailOptions: {
        to,
        subject,
        text,
        html,
      },
    });
  } catch (_error) {
    // Non-blocking infra path.
  }
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

async function markAllAsRead(userId, firmId) {
  const result = await Notification.updateMany(
    {
      userId: String(userId || '').toUpperCase(),
      firmId: String(firmId || ''),
      isRead: false,
    },
    {
      $set: {
        isRead: true,
      },
    },
  );

  return Number(result?.modifiedCount || 0);
}

module.exports = {
  NotificationTypes,
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
};
