const Notification = require('../models/Notification.model');

function toLegacyMessage(notification) {
  const type = String(notification?.type || '').toUpperCase();
  const docketId = notification?.docketId;
  if (!docketId) return 'Docket updated.';
  if (type === 'ASSIGNED') return `Docket ${docketId} was assigned to you.`;
  if (type === 'REASSIGNED') return `Docket ${docketId} was reassigned.`;
  if (type === 'DOCKET_ACTIVATED') return `Docket ${docketId} is now active.`;
  if (type === 'LIFECYCLE_CHANGED') return `Docket ${docketId} lifecycle changed.`;
  if (type === 'CLIENT_UPLOAD') return 'Client uploaded documents';
  return `Docket ${docketId} updated.`;
}

function normalizeNotification(notification) {
  return {
    ...notification,
    read: Boolean(notification?.read),
    message: toLegacyMessage(notification),
    docket_id: notification.docketId,
    created_at: notification.timestamp,
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
    const limit = Number(req.query.limit) || 10;

    const notifications = await Notification.find({ firmId, userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

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

    const notifications = await Notification.find({ firmId, userId })
      .sort({ timestamp: -1 })
      .lean();

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

    await Notification.updateOne(
      { _id: id, firmId, userId },
      { $set: { read: true } },
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
    });
  }
}

module.exports = {
  getNotifications,
  getAllNotifications,
  markAsRead,
};
