const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { listTeams, createTeam, updateTeam, assignUserToTeam } = require('../controllers/team.controller');

const router = express.Router();

router.get('/', authorizeFirmPermission('CASE_VIEW'), listTeams);
router.post('/', requireRole(['PRIMARY_ADMIN', 'ADMIN']), createTeam);
router.patch('/:id', requireRole(['PRIMARY_ADMIN', 'ADMIN']), updateTeam);
router.post('/:id/assign-user', requireRole(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']), assignUserToTeam);

module.exports = router;
