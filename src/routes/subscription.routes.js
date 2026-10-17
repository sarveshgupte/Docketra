const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/subscription.routes.schema.js');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getSubscriptionOverview,
  createOrder,
  getOrder,
  verifyUtr,
  webhook,
} = require('../controllers/subscription.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

/**
 * Subscription & Payment Routes
 * Accessible to Firm Primary Admins & Admins
 */
router.get('/', requireAdmin, getSubscriptionOverview);
router.post('/orders', requireAdmin, createOrder);
router.get('/orders/:orderId', requireAdmin, getOrder);
router.post('/orders/:orderId/verify-utr', requireAdmin, verifyUtr);

/**
 * Public Webhook for Gateway / Observer Notifications
 */
router.post('/webhook', webhook);

module.exports = router;
