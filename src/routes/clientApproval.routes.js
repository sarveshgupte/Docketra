const express = require('express');
const router = express.Router();
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
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
router.get('/clients', authorizeFirmPermission('CLIENT_VIEW'), listClients);
router.get('/clients/:clientId', authorizeFirmPermission('CLIENT_VIEW'), getClientById);

// Admin approval endpoints (mutations only through case workflow)
// Apply hierarchy check middleware to enforce top-most admin or canApproveClients permission
router.post('/:caseId/approve-new', authorizeFirmPermission('CLIENT_APPROVE'), checkClientApprovalPermission, approveNewClient);
router.post('/:caseId/approve-edit', authorizeFirmPermission('CLIENT_APPROVE'), checkClientApprovalPermission, approveClientEdit);
router.post('/:caseId/reject', authorizeFirmPermission('CLIENT_APPROVE'), checkClientApprovalPermission, rejectClientCase);

module.exports = router;
