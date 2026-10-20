const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/whatsappWebhook.routes.schema.js');
const {
  verifyWebhook,
  handleWebhook,
} = require('../controllers/whatsappWebhook.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

/**
 * Meta Cloud API Webhook Routes
 * GET /: Meta verification challenge handshake
 * POST /: Inbound WhatsApp media and document auto-ingestion
 */
router.get('/', verifyWebhook);
router.post('/', handleWebhook);

module.exports = router;
