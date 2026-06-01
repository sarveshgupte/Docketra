const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/clientPortal.routes.schema');
const {
  getClientStatusView,
  getClientStatusViewByCaseId,
} = require('../controllers/clientPortal.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/status-view', getClientStatusView);
router.get('/status-view/:caseId', getClientStatusViewByCaseId);

module.exports = router;
