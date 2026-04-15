const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firmMetrics.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getFirmMetrics } = require('../controllers/firmMetrics.controller');

const router = applyRouteValidation(express.Router({ mergeParams: true }), routeSchemas);

router.get('/metrics', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getFirmMetrics);

module.exports = router;
