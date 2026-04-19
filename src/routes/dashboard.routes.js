const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/dashboard.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getDashboardSummary, getOnboardingProgress, trackOnboardingEvent } = require('../controllers/dashboard.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/summary', userReadLimiter, getDashboardSummary);
router.get('/onboarding-progress', userReadLimiter, getOnboardingProgress);
router.post('/onboarding-event', userReadLimiter, trackOnboardingEvent);

module.exports = router;
