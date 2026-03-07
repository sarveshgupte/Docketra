'use strict';

const express = require('express');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { superadminLimiter } = require('../middleware/rateLimiters');
const { listSecurityAlerts, getSecuritySummary } = require('../controllers/security.controller');

const router = express.Router();

router.get('/alerts', requireSuperadmin, superadminLimiter, listSecurityAlerts);
router.get('/summary', requireSuperadmin, superadminLimiter, getSecuritySummary);

module.exports = router;
