const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/ai.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { setAiConfig, getAiConfigStatus, removeAiConfig } = require('../controllers/ai.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/config', userWriteLimiter, requirePrimaryAdmin, setAiConfig);
router.get('/status', userReadLimiter, getAiConfigStatus);
router.delete('/config', userWriteLimiter, requirePrimaryAdmin, removeAiConfig);

module.exports = router;
