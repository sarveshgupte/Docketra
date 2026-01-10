const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { authorize } = require('../middleware/authorize');
const SuperAdminPolicy = require('../policies/superadmin.policy');
const FirmPolicy = require('../policies/firm.policy');
const {
  createFirm,
  listFirms,
  updateFirmStatus,
  createFirmAdmin,
  getPlatformStats,
} = require('../controllers/superadmin.controller');

/**
 * Superadmin Routes
 * 
 * Platform-level management routes for Superadmin only
 * All routes require authentication and SUPER_ADMIN role
 * 
 * Superadmin can:
 * - Create and manage firms
 * - Activate/suspend firms
 * - Create firm admins
 * - View platform statistics
 * 
 * Superadmin CANNOT:
 * - Access firm data (cases, clients, tasks, attachments)
 * - Be seen or managed by firm admins
 */

// Platform statistics
router.get('/stats', authenticate, authorize(SuperAdminPolicy.canViewPlatformStats), getPlatformStats);

// Firm management
router.post('/firms', authenticate, authorize(FirmPolicy.canCreate), createFirm);
router.get('/firms', authenticate, authorize(FirmPolicy.canView), listFirms);
router.patch('/firms/:id', authenticate, authorize(FirmPolicy.canManageStatus), updateFirmStatus);

// Firm admin creation
router.post('/firms/:firmId/admin', authenticate, authorize(FirmPolicy.canCreateAdmin), createFirmAdmin);

module.exports = router;
