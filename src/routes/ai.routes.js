'use strict';

const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/ai.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { requireRole } = require('../middleware/rbac.middleware');
const { getAiConfiguration, updateAiConfiguration, testAiConfiguration } = require('../controllers/ai.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/configuration', userReadLimiter, requireRole(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']), getAiConfiguration);
router.put('/configuration', userWriteLimiter, requireRole(['PRIMARY_ADMIN', 'ADMIN']), updateAiConfiguration);
router.post('/test-configuration', userWriteLimiter, requireRole(['PRIMARY_ADMIN', 'ADMIN']), testAiConfiguration);

module.exports = router;
