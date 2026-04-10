const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { listTeams } = require('../controllers/team.controller');

const router = express.Router();

router.get('/', authorizeFirmPermission('CASE_VIEW'), listTeams);

module.exports = router;
