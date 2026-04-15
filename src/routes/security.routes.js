'use strict';

const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/security.routes.schema');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { superadminLimiter } = require('../middleware/rateLimiters');
const { listSecurityAlerts, getSecuritySummary } = require('../controllers/security.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/alerts', requireSuperadmin, superadminLimiter, listSecurityAlerts);
router.get('/summary', requireSuperadmin, superadminLimiter, getSecuritySummary);

module.exports = router;
