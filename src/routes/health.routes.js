const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/health.routes.schema');
const { liveness, readiness } = require('../controllers/health.controller');
const { publicLimiter } = require('../middleware/rateLimiters');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/liveness', publicLimiter, liveness);
router.get('/readiness', publicLimiter, readiness);
router.get('/', publicLimiter, liveness);

module.exports = router;
