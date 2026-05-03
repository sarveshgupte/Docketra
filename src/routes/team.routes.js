const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/team.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { listTeams, createTeam, updateTeam, assignUserToTeam, addUserToQcWorkbasket } = require('../controllers/team.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/', authorizeFirmPermission('CASE_VIEW'), listTeams);
router.post('/', requirePrimaryAdmin, userWriteLimiter, createTeam);
router.patch('/:id', requirePrimaryAdmin, userWriteLimiter, updateTeam);
router.post('/:id/assign-user', requirePrimaryAdmin, userWriteLimiter, assignUserToTeam);
router.post('/:id/qc/add-user', authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, addUserToQcWorkbasket);

module.exports = router;
