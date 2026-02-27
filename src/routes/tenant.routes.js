const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/tenant.routes.schema');
const { authLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { updateTenantStorage } = require('../controllers/tenantStorage.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/storage/update', authorizeFirmPermission('CASE_UPDATE'), authLimiter, updateTenantStorage);

module.exports = router;
