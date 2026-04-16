const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/settings.routes.schema');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getSettingsAudit } = require('../controllers/admin.controller');

router.get('/audit', authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getSettingsAudit);

module.exports = router;
