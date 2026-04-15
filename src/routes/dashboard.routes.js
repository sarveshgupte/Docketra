const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/dashboard.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getDashboardSummary } = require('../controllers/dashboard.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/summary', userReadLimiter, getDashboardSummary);

module.exports = router;
