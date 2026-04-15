const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/workType.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  listWorkTypes,
  createWorkType,
  createSubWorkType,
  updateWorkTypeStatus,
} = require('../controllers/workType.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/', authorizeFirmPermission('WORKTYPE_VIEW'), userReadLimiter, listWorkTypes);
router.post('/', authorizeFirmPermission('WORKTYPE_MANAGE'), userWriteLimiter, createWorkType);
router.post('/sub-types', authorizeFirmPermission('WORKTYPE_MANAGE'), userWriteLimiter, createSubWorkType);
router.patch('/:workTypeId/status', authorizeFirmPermission('WORKTYPE_MANAGE'), userWriteLimiter, updateWorkTypeStatus);

module.exports = router;
