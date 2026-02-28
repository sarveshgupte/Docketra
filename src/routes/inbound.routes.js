const express = require('express');
const rateLimit = require('express-rate-limit');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/inbound.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { handleInboundEmail } = require('../controllers/inboundEmail.controller');
const inboundEmailRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Inbound Email Routes
 * Handles webhook from email providers
 */

// POST /api/inbound/email - Receive inbound email
router.post('/email', inboundEmailRateLimiter, handleInboundEmail);

module.exports = router;
