const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/insights.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getInsightsOverview } = require('../controllers/insights.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/overview', userReadLimiter, getInsightsOverview);

module.exports = router;
