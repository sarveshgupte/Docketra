const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { listTeams, createTeam, updateTeam, assignUserToTeam } = require('../controllers/team.controller');

const router = express.Router();

router.get('/', authorizeFirmPermission('CASE_VIEW'), listTeams);
router.post('/', requirePrimaryAdmin, createTeam);
router.patch('/:id', requirePrimaryAdmin, updateTeam);
router.post('/:id/assign-user', requirePrimaryAdmin, assignUserToTeam);

module.exports = router;
