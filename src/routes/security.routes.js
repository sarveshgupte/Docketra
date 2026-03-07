'use strict';

const express = require('express');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { listSecurityAlerts, getSecuritySummary } = require('../controllers/security.controller');

const router = express.Router();

router.get('/alerts', requireSuperadmin, listSecurityAlerts);
router.get('/summary', requireSuperadmin, getSecuritySummary);

module.exports = router;
