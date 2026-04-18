const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/team.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { listTeams, createTeam, updateTeam, assignUserToTeam } = require('../controllers/team.controller');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, listTeams);
router.post('/', requirePrimaryAdmin, userWriteLimiter, createTeam);
router.patch('/:id', requirePrimaryAdmin, userWriteLimiter, updateTeam);
router.post('/:id/assign-user', requirePrimaryAdmin, userWriteLimiter, assignUserToTeam);

module.exports = router;
