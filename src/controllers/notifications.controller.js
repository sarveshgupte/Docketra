const {
  getUserNotifications,
  markAsRead: markNotificationAsRead,
  markAllAsRead: markAllNotificationsAsRead,
} = require('../services/notification.service');
const {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
} = require('../services/notificationPreference.service');
const log = require('../utils/log');

function normalizeNotification(notification) {
  return {
    _id: notification._id,
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    docket_id: notification.docketId,
    docketId: notification.docketId,
    isRead: Boolean(notification?.isRead),
    read: Boolean(notification?.isRead),
    groupCount: Number(notification?.groupCount || 1),
    createdAt: notification.createdAt,
    created_at: notification.createdAt,
  };
}

async function getNotifications(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    if (!firmId || !userId) {
      return res.json({
        success: true,
        data: [],
      });
    }
    const notifications = await getUserNotifications(userId, firmId, {
      limit: Number(req.query.limit) || 10,
    });

    return res.json({
      success: true,
      data: notifications.map(normalizeNotification),
    });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to load notifications', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications',
    });
  }
}

async function getAllNotifications(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    if (!firmId || !userId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const notifications = await getUserNotifications(userId, firmId, {
      limit: Number(req.query.limit) || 100,
    });

    return res.json({
      success: true,
      data: notifications.map(normalizeNotification),
    });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to load all notifications', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications',
    });
  }
}

async function markAsRead(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    const { id } = req.params;

    await markNotificationAsRead(id, userId, firmId);

    return res.json({ success: true });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to mark notification as read', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
}


async function markAllAsRead(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    if (!firmId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Firm and user context required',
      });
    }

    const updatedCount = await markAllNotificationsAsRead(userId, firmId);

    return res.json({ success: true, data: { updatedCount } });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to mark all notifications as read', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
}

async function getPreferences(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    if (!firmId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Firm and user context required',
      });
    }
    const preferences = await getOrCreateNotificationPreferences(userId, firmId);
    return res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to load notification preferences', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load notification preferences',
    });
  }
}

async function updatePreferences(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();
    if (!firmId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Firm and user context required',
      });
    }
    const preferences = await updateNotificationPreferences(userId, firmId, req.body || {});
    return res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    log.error('[NOTIFICATIONS] Failed to update notification preferences', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
    });
  }
}

module.exports = {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
};
