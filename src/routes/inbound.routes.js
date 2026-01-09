const express = require('express');
const router = express.Router();
const { handleInboundEmail } = require('../controllers/inboundEmail.controller');

/**
 * Inbound Email Routes
 * Handles webhook from email providers
 */

// POST /api/inbound/email - Receive inbound email
router.post('/email', handleInboundEmail);

module.exports = router;
