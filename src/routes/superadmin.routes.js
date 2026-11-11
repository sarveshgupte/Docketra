const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/superadmin.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { getSuperadminAiAssistantChat } = require('../controllers/superadminAiAssistant.controller');
const { authorize } = require('../middleware/authorize');
const SuperAdminPolicy = require('../policies/superadmin.policy');
const FirmPolicy = require('../policies/firm.policy');
const { superadminLimiter, superadminAdminResendLimiter, superadminAdminLifecycleLimiter, superadminAdminManagementLimiter } = require('../middleware/rateLimiters');
const {
  createFirm,
  listFirms,
  updateFirmStatus,
  createFirmAdmin,
  listFirmAdmins,
  resendAdminAccess,
  getFirmAdminDetails,
  deleteFirmAdmin,
  updateFirmAdminStatus,
  forceResetFirmAdmin,
  getPlatformStats,
  disableFirmImmediately,
  getOperationalHealth,
  switchFirm,
  exitFirm,
  activateFirm,
  deactivateFirm,
  getOnboardingInsights,
  getOnboardingInsightDetails,
  getOnboardingAlerts,
  getSupportDiagnostics,
  getFirmHealth,
  getPlansCapacity,
  getPilotReadiness,
  updateFirmPlanCapacity,
  getSuperadminAuditLogs,
  getSuperadminGlobalSearch,
  getSuperadminFeatureFlags,
  updateSuperadminFeatureFlag,
} = require('../controllers/superadmin.controller');

// Hard fail-closed boundary: every route in this router is superadmin-only.
router.use(requireSuperadmin);

/**
 * Superadmin Routes
 * 
 * Platform-level management routes for Superadmin only
 * All routes require authentication and SUPER_ADMIN role
 * Rate limited to prevent abuse even from privileged accounts
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
router.get('/stats', authorize(SuperAdminPolicy.canViewPlatformStats), getPlatformStats);
router.get('/onboarding-insights', authorize(SuperAdminPolicy.canViewPlatformStats), getOnboardingInsights);
router.get('/onboarding-insights/details', authorize(SuperAdminPolicy.canViewPlatformStats), getOnboardingInsightDetails);
router.get('/onboarding-alerts', authorize(SuperAdminPolicy.canViewPlatformStats), getOnboardingAlerts);
router.get('/health', getOperationalHealth);
router.get('/diagnostics', getSupportDiagnostics);
router.get('/firm-health', authorize(SuperAdminPolicy.canViewPlatformStats), getFirmHealth);
router.get('/audit-logs', authorize(SuperAdminPolicy.canViewPlatformStats), getSuperadminAuditLogs);
router.get('/search', authorize(SuperAdminPolicy.canViewPlatformStats), getSuperadminGlobalSearch);
router.get('/plans', authorize(SuperAdminPolicy.canViewPlatformStats), getPlansCapacity);
router.get('/pilot-readiness', authorize(SuperAdminPolicy.canViewPlatformStats), getPilotReadiness);
router.get('/feature-flags', authorize(SuperAdminPolicy.canViewPlatformStats), getSuperadminFeatureFlags);
router.patch('/feature-flags/:key', authorize(SuperAdminPolicy.canManageFirms), superadminAdminManagementLimiter, updateSuperadminFeatureFlag);

// Firm management
router.post('/firms', authorize(FirmPolicy.canCreate), createFirm);
router.get('/firms', authorize(FirmPolicy.canView), listFirms);
router.patch('/firms/:id', authorize(FirmPolicy.canManageStatus), updateFirmStatus);
router.patch('/firms/:id/status', authorize(FirmPolicy.canManageStatus), updateFirmStatus);
router.patch('/firms/:id/activate', authorize(FirmPolicy.canManageStatus), activateFirm);
router.patch('/firms/:id/deactivate', authorize(FirmPolicy.canManageStatus), deactivateFirm);
router.patch('/firms/:firmId/plan-capacity', authorize(FirmPolicy.canManageStatus), superadminAdminManagementLimiter, updateFirmPlanCapacity);
router.post('/firms/:id/disable', authorize(FirmPolicy.canManageStatus), disableFirmImmediately);

// Firm admin creation
router.post('/firms/:firmId/admin', authorize(FirmPolicy.canCreateAdmin), superadminAdminManagementLimiter, createFirmAdmin);
router.post('/firms/:firmId/admins', authorize(FirmPolicy.canCreateAdmin), superadminAdminManagementLimiter, createFirmAdmin);

// Resend admin access (invite or password reset)
router.post('/firms/:firmId/admin/resend-access', authorize(FirmPolicy.canResendAdminAccess), superadminAdminResendLimiter, resendAdminAccess);
router.get('/firms/:firmId/admin', authorize(FirmPolicy.canResendAdminAccess), superadminAdminLifecycleLimiter, getFirmAdminDetails);
router.get('/firms/:firmId/admins', authorize(FirmPolicy.canResendAdminAccess), superadminAdminLifecycleLimiter, listFirmAdmins);
router.patch('/firms/:firmId/admin/status', authorize(FirmPolicy.canResendAdminAccess), superadminAdminManagementLimiter, updateFirmAdminStatus);
router.patch('/firms/:firmId/admins/:adminId/status', authorize(FirmPolicy.canResendAdminAccess), superadminAdminManagementLimiter, updateFirmAdminStatus);
router.post('/firms/:firmId/admin/force-reset', authorize(FirmPolicy.canResendAdminAccess), superadminAdminManagementLimiter, forceResetFirmAdmin);
router.post('/firms/:firmId/admins/:adminId/force-reset', authorize(FirmPolicy.canResendAdminAccess), superadminAdminManagementLimiter, forceResetFirmAdmin);
router.delete('/firms/:firmId/admins/:adminId', authorize(FirmPolicy.canResendAdminAccess), superadminAdminManagementLimiter, deleteFirmAdmin);

// Firm context switching (impersonation)
router.post('/switch-firm', switchFirm);
router.post('/exit-firm', exitFirm);

// SuperAdmin-only AI Assistant Chat
router.post('/ai-assistant/chat', getSuperadminAiAssistantChat);

module.exports = router;
