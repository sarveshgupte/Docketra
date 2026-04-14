const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/sla.routes.schema');
const { authorizeFirmPermission, requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { deleteRule, listRules, saveRule } = require('../controllers/sla.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/rules', requireAdmin, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, listRules);
router.post('/rules', requireAdmin, authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, saveRule);
router.delete('/rules/:ruleId', requireAdmin, authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, deleteRule);

module.exports = router;
