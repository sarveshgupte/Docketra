const Notification = require('../models/Notification.model');

async function getNotifications(req, res) {
  try {
    const firmId = req.user?.firmId;
    const userId = String(req.user?.xID || '').toUpperCase();

    const notifications = await Notification.find({ firmId, user_id: userId })
      .sort({ created_at: -1 })
      .lean();

    return res.json({ success: true, data: notifications });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load notifications',
    });
  }
}

module.exports = {
  getNotifications,
};
