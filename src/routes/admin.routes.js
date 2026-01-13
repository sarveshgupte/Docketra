const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { superadminLimiter, userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  getAdminStats,
  resendInviteEmail,
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
  updateRestrictedClients,
  getStorageConfig,
  updateStorageConfig,
  disconnectStorage,
  getSystemDiagnostics,
  restoreUser,
  restoreClient,
  restoreCase,
  restoreTask,
  getRetentionPreview,
} = require('../controllers/admin.controller');

/**
 * Admin Routes
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email
 * PR: Case Lifecycle - Admin case visibility endpoints
 * PR: Fix Case Lifecycle - Added resolved cases endpoint
 * All routes require authentication and admin role
 * Superadmin is blocked from accessing these routes (firm data)
 * Rate limited to prevent abuse even from privileged accounts
 */

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', authenticate, attachFirmContext, authorizeFirmPermission('ADMIN_STATS'), superadminLimiter, getAdminStats);

// GET /api/admin/system-diagnostics - Operational diagnostics (cached)
router.get('/system-diagnostics', authenticate, attachFirmContext, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getSystemDiagnostics);

// POST /api/admin/users/:xID/resend-invite - Resend invite email for user
// PR #48: Admin-only endpoint that bypasses password enforcement
router.post('/users/:xID/resend-invite', authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, resendInviteEmail);

// PATCH /api/admin/users/:xID/restrict-clients - Update user's client access restrictions
// Admin-only endpoint to manage client deny-list per user
router.patch('/users/:xID/restrict-clients', authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateRestrictedClients);

// POST /api/admin/users/:id/restore - Restore soft-deleted user
router.post('/users/:id/restore', authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, restoreUser);

// GET /api/admin/cases/open - Get all open cases (admin view)
router.get('/cases/open', authenticate, attachFirmContext, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllOpenCases);

// GET /api/admin/cases/pending - Get all pending cases (admin view)
router.get('/cases/pending', authenticate, attachFirmContext, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllPendingCases);

// GET /api/admin/cases/filed - Get all filed cases (admin view)
router.get('/cases/filed', authenticate, attachFirmContext, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllFiledCases);

// GET /api/admin/cases/resolved - Get all resolved cases (admin view)
router.get('/cases/resolved', authenticate, attachFirmContext, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllResolvedCases);

// POST /api/admin/cases/:id/restore - Restore a soft-deleted case
router.post('/cases/:id/restore', authenticate, attachFirmContext, authorizeFirmPermission('CASE_ADMIN_VIEW'), userWriteLimiter, restoreCase);

// Storage configuration endpoints (Admin only)
router.get('/storage', authenticate, attachFirmContext, authorizeFirmPermission('STORAGE_MANAGE'), userReadLimiter, getStorageConfig);
router.put('/storage', authenticate, attachFirmContext, authorizeFirmPermission('STORAGE_MANAGE'), userWriteLimiter, updateStorageConfig);
router.post('/storage/disconnect', authenticate, attachFirmContext, authorizeFirmPermission('STORAGE_MANAGE'), userWriteLimiter, disconnectStorage);

// Client restore endpoint
router.post('/clients/:id/restore', authenticate, attachFirmContext, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, restoreClient);

// Task restore endpoint
router.post('/tasks/:id/restore', authenticate, attachFirmContext, authorizeFirmPermission('TASK_MANAGE'), userWriteLimiter, restoreTask);

// Retention preview endpoint
router.get('/retention-preview', authenticate, attachFirmContext, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getRetentionPreview);

module.exports = router;
