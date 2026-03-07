'use strict';

const express = require('express');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { listSecurityAlerts } = require('../controllers/security.controller');

const router = express.Router();

router.get('/alerts', requireSuperadmin, listSecurityAlerts);

module.exports = router;
