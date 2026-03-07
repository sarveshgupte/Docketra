const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/clientApproval.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  sensitiveLimiter,
  userReadLimiter,
} = require('../middleware/rateLimiters');
const {
  approveNewClient,
  approveClientEdit,
  rejectClientCase,
  getClientById,
  listClients,
} = require('../controllers/clientApproval.controller');
const { checkClientApprovalPermission } = require('../middleware/adminApproval.middleware');

/**
 * Client Approval Routes
 * 
 * Case-driven client management endpoints.
 * All client mutations require Admin approval through cases.
 * 
 * NO direct edit/delete endpoints - immutability enforced.
 */

// Read-only endpoints (no mutations)
router.get('/clients', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClients);
router.get('/clients/:clientId', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClientById);

// Admin approval endpoints (mutations only through case workflow)
// Apply hierarchy check middleware to enforce top-most admin or canApproveClients permission
router.post('/:caseId/approve-new', authorizeFirmPermission('CLIENT_APPROVE'), sensitiveLimiter, checkClientApprovalPermission, approveNewClient);
router.post('/:caseId/approve-edit', authorizeFirmPermission('CLIENT_APPROVE'), sensitiveLimiter, checkClientApprovalPermission, approveClientEdit);
router.post('/:caseId/reject', authorizeFirmPermission('CLIENT_APPROVE'), sensitiveLimiter, checkClientApprovalPermission, rejectClientCase);

module.exports = router;
