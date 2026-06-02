const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/docketraIntelligence.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const {
  getDeadlineRiskIntelligence,
  getWorkbasketCapacityIntelligence,
  getWorkloadIntelligence,
} = require('../controllers/docketraIntelligence.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/workload', userReadLimiter, getWorkloadIntelligence);
router.get('/workbasket-capacity', userReadLimiter, getWorkbasketCapacityIntelligence);
router.get('/deadline-risk', userReadLimiter, getDeadlineRiskIntelligence);

module.exports = router;
