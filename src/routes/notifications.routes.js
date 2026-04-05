const express = require('express');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getNotifications } = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', userReadLimiter, getNotifications);

module.exports = router;
