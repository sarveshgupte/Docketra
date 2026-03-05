const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  listWorkTypes,
  createWorkType,
  createSubWorkType,
  updateWorkTypeStatus,
} = require('../controllers/workType.controller');

const router = express.Router();

router.get('/', authorizeFirmPermission('WORKTYPE_VIEW'), listWorkTypes);
router.post('/', authorizeFirmPermission('WORKTYPE_MANAGE'), createWorkType);
router.post('/sub-types', authorizeFirmPermission('WORKTYPE_MANAGE'), createSubWorkType);
router.patch('/:workTypeId/status', authorizeFirmPermission('WORKTYPE_MANAGE'), updateWorkTypeStatus);

module.exports = router;
