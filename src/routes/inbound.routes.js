const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/inbound.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { handleInboundEmail } = require('../controllers/inboundEmail.controller');

/**
 * Inbound Email Routes
 * Handles webhook from email providers
 */

// POST /api/inbound/email - Receive inbound email
router.post('/email', handleInboundEmail);

module.exports = router;
