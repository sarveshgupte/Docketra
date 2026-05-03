const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/team.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { listTeams, createTeam, updateTeam, assignUserToTeam, addUserToQcWorkbasket } = require('../controllers/team.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/', authorizeFirmPermission('CASE_VIEW'), listTeams);
router.post('/', requirePrimaryAdmin, createTeam);
router.patch('/:id', requirePrimaryAdmin, updateTeam);
router.post('/:id/assign-user', requirePrimaryAdmin, assignUserToTeam);
router.post('/:id/qc/add-user', authorizeFirmPermission('USER_MANAGE'), addUserToQcWorkbasket);

module.exports = router;
