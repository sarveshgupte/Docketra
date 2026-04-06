const express = require('express');
const { userReadLimiter } = require('../middleware/rateLimiters');
const {
  getNotifications,
  getAllNotifications,
  markAsRead,
} = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', userReadLimiter, getNotifications);
router.get('/all', userReadLimiter, getAllNotifications);
router.patch('/:id/read', userReadLimiter, markAsRead);

module.exports = router;
