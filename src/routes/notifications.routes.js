const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/notifications.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const {
  getNotifications,
  getAllNotifications,
  markAsRead,
} = require('../controllers/notifications.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/', userReadLimiter, getNotifications);
router.get('/all', userReadLimiter, getAllNotifications);
router.patch('/:id/read', userReadLimiter, markAsRead);
router.post('/:id/read', userReadLimiter, markAsRead);

module.exports = router;
