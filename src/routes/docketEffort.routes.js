const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const routeSchemas = require('../schemas/docketEffort.routes.schema');
const {
  createDocketEffort,
  getDocketEfforts,
  deleteDocketEffort,
  updateDocketBudget,
  getProfitabilityReports,
} = require('../controllers/docketEffort.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

// Effort Logging & Management
router.post('/', userWriteLimiter, createDocketEffort);
router.get('/', userReadLimiter, getDocketEfforts);
router.delete('/:id', userWriteLimiter, deleteDocketEffort);

// Docket Budget Adjustments
router.patch('/docket/:caseId/budget', userWriteLimiter, updateDocketBudget);

// Analytical Profitability Reporting
router.get('/reports/profitability', userReadLimiter, requireAdmin, getProfitabilityReports);

module.exports = router;
