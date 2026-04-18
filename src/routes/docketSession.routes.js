const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/docketSession.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { checkCaseClientAccess } = require('../middleware/clientAccess.middleware');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const {
  startSession,
  heartbeat,
  endSession,
} = require('../services/docketSession.service');

const router = applyRouteValidation(express.Router(), routeSchemas);

const resolveActor = (req) => ({
  docketId: req.params.id,
  firmId: req.user?.firmId,
  userId: req.user?.xID,
  userRole: req.user?.role,
  userEmail: req.user?.email,
  req,
});

router.post('/dockets/:id/session/start', authorizeFirmPermission('CASE_VIEW'), checkCaseClientAccess, wrapWriteHandler(async (req) => {
  const session = await startSession(resolveActor(req));
  return {
    success: true,
    data: session,
  };
}));

router.post('/dockets/:id/session/heartbeat', authorizeFirmPermission('CASE_VIEW'), checkCaseClientAccess, wrapWriteHandler(async (req) => {
  const session = await heartbeat(resolveActor(req));
  return {
    success: true,
    data: session,
  };
}));

router.post('/dockets/:id/session/end', authorizeFirmPermission('CASE_VIEW'), checkCaseClientAccess, wrapWriteHandler(async (req) => {
  const session = await endSession(resolveActor(req));
  return {
    success: true,
    data: session,
  };
}));

module.exports = router;
