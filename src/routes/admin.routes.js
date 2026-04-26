const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/admin.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin, requireManagerOrPrimaryAdmin } = require('../middleware/rbac.middleware');
const { superadminLimiter, userReadLimiter, userWriteLimiter, sensitiveLimiter } = require('../middleware/rateLimiters');
const { adminBaseAccess } = require('./routeGroups');
const {
  getAdminStats,
  resendInviteEmail,
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
  getHierarchyTree,
  updateUserHierarchy,
  updateRestrictedClients,
  getFirmSettings,
  getFirmSettingsActivity,
  getSettingsAudit,
  updateFirmSettings,
  getCmsIntakeSettings,
  updateCmsIntakeSettings,
  regenerateCmsIntakeApiKey,
  getStorageConfig,
  updateStorageConfig,
  disconnectStorage,
  getSystemDiagnostics,
  restoreUser,
  restoreClient,
  restoreCase,
  restoreTask,
  getRetentionPreview,
  getAdminAuditLogs,
} = require('../controllers/admin.controller');
const {
  getAllUsers,
  createUser,
  activateUser,
  deactivateUser,
} = require('../controllers/auth.controller');
const {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  toggleSubcategoryStatus,
  deleteSubcategory,
} = require('../controllers/category.controller');
const {
  getClients,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
  updateClientFactSheet,
  uploadFactSheetFile,
  deleteFactSheetFile,
} = require('../controllers/client.controller');
const {
  listWorkbaskets,
  createWorkbasket,
  renameWorkbasket,
  toggleWorkbasketStatus,
  updateUserWorkbaskets,
} = require('../controllers/workbasket.controller');


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

router.get('/stats', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), superadminLimiter, getAdminStats);

router.get('/clients', ...adminBaseAccess, authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClients);
router.post('/clients', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, createClient);
router.put('/clients/:clientId', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, updateClient);
router.patch('/clients/:clientId/status', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, toggleClientStatus);
router.post('/clients/:clientId/change-name', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, changeLegalName);
router.put('/clients/:clientId/fact-sheet', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, updateClientFactSheet);
router.post('/clients/:clientId/fact-sheet/files', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, uploadFactSheetFile);
router.delete('/clients/:clientId/fact-sheet/files/:fileId', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, deleteFactSheetFile);

router.get('/categories', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userReadLimiter, getCategories);
router.post('/categories', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, createCategory);
router.put('/categories/:id', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, updateCategory);
router.patch('/categories/:id/status', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, toggleCategoryStatus);
router.delete('/categories/:id', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, deleteCategory);
router.post('/categories/:id/subcategories', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, addSubcategory);
router.put('/categories/:id/subcategories/:subcategoryId', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, updateSubcategory);
router.patch('/categories/:id/subcategories/:subcategoryId/status', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, toggleSubcategoryStatus);
router.delete('/categories/:id/subcategories/:subcategoryId', ...adminBaseAccess, authorizeFirmPermission('CATEGORY_MANAGE'), userWriteLimiter, deleteSubcategory);

router.get('/hierarchy', ...adminBaseAccess, authorizeFirmPermission('USER_VIEW'), userReadLimiter, getHierarchyTree);
router.get('/audit-logs', ...adminBaseAccess, requireManagerOrPrimaryAdmin, authorizeFirmPermission('USER_VIEW'), userReadLimiter, getAdminAuditLogs);
router.get('/users', ...adminBaseAccess, authorizeFirmPermission('USER_VIEW'), userReadLimiter, getAllUsers);
router.post('/users', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE'), sensitiveLimiter, createUser);
router.put('/users/:xID/activate', ...adminBaseAccess, requirePrimaryAdmin, authorizeFirmPermission('USER_MANAGE'), sensitiveLimiter, activateUser);
router.put('/users/:xID/deactivate', ...adminBaseAccess, requirePrimaryAdmin, authorizeFirmPermission('USER_MANAGE'), sensitiveLimiter, deactivateUser);
router.post('/users/:xID/resend-invite', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, resendInviteEmail);

router.patch('/users/:xID/restrict-clients', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateRestrictedClients);
router.patch('/users/:xID/workbaskets', ...adminBaseAccess, requireManagerOrPrimaryAdmin, authorizeFirmPermission('WORKBASKET_MANAGE'), userWriteLimiter, updateUserWorkbaskets);
router.patch('/users/:id/hierarchy', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateUserHierarchy);
router.get('/firm-settings', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getFirmSettings);
router.get('/firm-settings/activity', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getFirmSettingsActivity);
router.get('/settings/audit', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getSettingsAudit);
router.put('/firm-settings', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, updateFirmSettings);
router.get('/cms-intake-settings', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getCmsIntakeSettings);
router.put('/cms-intake-settings', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, updateCmsIntakeSettings);
router.post('/cms-intake-settings/intake-api-key/regenerate', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), sensitiveLimiter, regenerateCmsIntakeApiKey);
router.get('/workbaskets', ...adminBaseAccess, authorizeFirmPermission('CASE_VIEW'), userReadLimiter, listWorkbaskets);
router.post('/workbaskets', ...adminBaseAccess, requireManagerOrPrimaryAdmin, authorizeFirmPermission('WORKBASKET_MANAGE'), userWriteLimiter, createWorkbasket);
router.put('/workbaskets/:workbasketId', ...adminBaseAccess, requireManagerOrPrimaryAdmin, authorizeFirmPermission('WORKBASKET_MANAGE'), userWriteLimiter, renameWorkbasket);
router.patch('/workbaskets/:workbasketId/status', ...adminBaseAccess, requireManagerOrPrimaryAdmin, authorizeFirmPermission('WORKBASKET_MANAGE'), userWriteLimiter, toggleWorkbasketStatus);

router.post('/users/:id/restore', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, restoreUser);

router.get('/system-diagnostics', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getSystemDiagnostics);

router.get('/cases/open', ...adminBaseAccess, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllOpenCases);
router.get('/cases/pending', ...adminBaseAccess, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllPendingCases);
router.get('/cases/filed', ...adminBaseAccess, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllFiledCases);
router.get('/cases/resolved', ...adminBaseAccess, authorizeFirmPermission('CASE_ADMIN_VIEW'), userReadLimiter, getAllResolvedCases);
router.post('/cases/:id/restore', ...adminBaseAccess, authorizeFirmPermission('CASE_ADMIN_VIEW'), userWriteLimiter, restoreCase);

router.get('/storage', ...adminBaseAccess, authorizeFirmPermission('STORAGE_MANAGE'), userReadLimiter, getStorageConfig);
router.put('/storage', ...adminBaseAccess, authorizeFirmPermission('STORAGE_MANAGE'), userWriteLimiter, updateStorageConfig);
router.post('/storage/disconnect', ...adminBaseAccess, authorizeFirmPermission('STORAGE_MANAGE'), userWriteLimiter, disconnectStorage);

router.post('/clients/:id/restore', ...adminBaseAccess, authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, restoreClient);
router.post('/tasks/:id/restore', ...adminBaseAccess, authorizeFirmPermission('TASK_MANAGE'), userWriteLimiter, restoreTask);
router.get('/retention-preview', ...adminBaseAccess, authorizeFirmPermission('ADMIN_STATS'), userReadLimiter, getRetentionPreview);

module.exports = router;
