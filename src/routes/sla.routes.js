const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/sla.routes.schema');
const { authorizeFirmPermission, requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { deleteRule, listRules, saveRule } = require('../controllers/sla.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/rules', userReadLimiter, requireAdmin, authorizeFirmPermission('ADMIN_STATS'), listRules);
router.post('/rules', userWriteLimiter, requireAdmin, authorizeFirmPermission('ADMIN_STATS'), saveRule);
router.delete('/rules/:ruleId', userWriteLimiter, requireAdmin, authorizeFirmPermission('ADMIN_STATS'), deleteRule);

module.exports = router;
