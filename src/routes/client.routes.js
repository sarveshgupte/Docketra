const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, blockSuperadmin } = require('../middleware/permission.middleware');
const { authorize } = require('../middleware/authorize');
const ClientPolicy = require('../policies/client.policy');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
} = require('../controllers/client.controller');

/**
 * Client Management Routes
 * 
 * PR #39: Direct client management for Admin users
 * Admin can create, edit (restricted fields), enable/disable clients
 * No hard deletes allowed - only soft delete via isActive/status flag
 * 
 * PR #49: Client lifecycle governance
 * - Business name changes only via dedicated endpoint with audit trail
 * - PAN/TAN/CIN are immutable
 * - Only email and contact numbers can be updated normally
 */

// Block SuperAdmin from accessing client routes
router.use(authenticate);
router.use(blockSuperadmin);

// Public/authenticated endpoints
router.get('/', authorize(ClientPolicy.canView), getClients);
router.get('/:clientId', authorize(ClientPolicy.canView), getClientById);

// Admin-only endpoints
router.post('/', authenticate, authorize(ClientPolicy.canCreate), createClient);
router.put('/:clientId', authenticate, authorize(ClientPolicy.canUpdate), updateClient);
router.patch('/:clientId/status', authenticate, authorize(ClientPolicy.canManageStatus), toggleClientStatus);
router.post('/:clientId/change-name', authenticate, authorize(ClientPolicy.canUpdate), changeLegalName);

module.exports = router;
