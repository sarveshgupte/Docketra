const {
  getUserNotifications,
  markAsRead: markNotificationAsRead,
} = require('../services/notification.service');
const {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
} = require('../services/notificationPreference.service');

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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load notifications',
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load notifications',
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load notification preferences',
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notification preferences',
    });
  }
}

module.exports = {
  getNotifications,
  getAllNotifications,
  markAsRead,
  getPreferences,
  updatePreferences,
};
