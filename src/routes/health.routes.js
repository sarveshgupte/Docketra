const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/health.routes.schema');
const { liveness, readiness } = require('../controllers/health.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/liveness', liveness);
router.get('/readiness', readiness);
router.get('/', liveness);

module.exports = router;
