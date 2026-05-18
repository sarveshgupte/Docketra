const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/search.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { searchLimiter, sensitiveLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { checkCaseClientAccess } = require('../middleware/caseAccess.middleware');
const {
  globalWorklist,
  categoryWorklist,
  employeeWorklist,
  moveDocket,
} = require('../controllers/worklist.controller');

router.get('/global', authorizeFirmPermission('CASE_VIEW'), searchLimiter, globalWorklist);
router.get('/category/:categoryId', authorizeFirmPermission('CASE_VIEW'), searchLimiter, categoryWorklist);
router.get('/employee/me', authorizeFirmPermission('CASE_VIEW'), searchLimiter, employeeWorklist);
router.post('/employee/:caseId/move', authorizeFirmPermission('CASE_ASSIGN'), sensitiveLimiter, userWriteLimiter, checkCaseClientAccess, moveDocket);

module.exports = router;
