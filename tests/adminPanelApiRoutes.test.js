#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

async function testAdminRoutesExposeClientManagement() {
  const authenticate = () => {};
  const attachFirmContext = () => {};
  const clientViewGuard = () => {};
  const clientManageGuard = () => {};
  const categoryManageGuard = () => {};
  const userViewGuard = () => {};
  const userManageGuard = () => {};
  const adminStatsGuard = () => {};
  const superadminLimiter = () => {};
  const userReadLimiter = () => {};
  const userWriteLimiter = () => {};
  const sensitiveLimiter = () => {};
  const getAdminStats = () => {};
  const getClients = () => {};
  const getCategories = () => {};
  const getHierarchyTree = () => {};
  const getAdminAuditLogs = () => {};
  const getAllUsers = () => {};
  const createUser = () => {};
  const activateUser = () => {};
  const deactivateUser = () => {};
  const sendUserPasswordReset = () => {};
  const uploadSingle = () => {};
  const enforceUploadSecurity = () => {};
  const permissionGuards = {
    ADMIN_STATS: adminStatsGuard,
    CLIENT_VIEW: clientViewGuard,
    CLIENT_MANAGE: clientManageGuard,
    CATEGORY_MANAGE: categoryManageGuard,
    USER_VIEW: userViewGuard,
    USER_MANAGE: userManageGuard,
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../middleware/requestValidation.middleware') {
      return { applyRouteValidation: (router) => router };
    }
    if (request === '../schemas/admin.routes.schema.js') {
      return {};
    }
    if (request === '../middleware/auth.middleware') {
      return { authenticate };
    }
    if (request === '../middleware/firmContext.middleware') {
      return { attachFirmContext };
    }
    if (request === '../middleware/permission.middleware') {
      return {
        authorizeFirmPermission: (permission) => permissionGuards[permission] || (() => {}),
        requireAdmin: () => {},
      };
    }
    if (request === '../middleware/rateLimiters') {
      return { superadminLimiter, userReadLimiter, userWriteLimiter, sensitiveLimiter };
    }
    if (request === '../middleware/rbac.middleware') {
      return {
        requirePrimaryAdmin: () => {},
        requireManagerOrPrimaryAdmin: () => {},
      };
    }
    if (request === '../middleware/uploadProtection.middleware') {
      return {
        createSecureUpload: () => ({ single: () => uploadSingle }),
        enforceUploadSecurity,
      };
    }
    if (request === '../controllers/admin.controller') {
      return {
        getAdminStats,
        resendInviteEmail: () => {},
        sendUserPasswordReset,
        getHierarchyTree,
        getAdminAuditLogs,
        getAllOpenCases: () => {},
        getAllPendingCases: () => {},
        getAllFiledCases: () => {},
        getAllResolvedCases: () => {},
        updateUserHierarchy: () => {},
        updateRestrictedClients: () => {},
        getFirmSettings: () => {},
        getFirmSettingsActivity: () => {},
        getSettingsAudit: () => {},
        updateFirmSettings: () => {},
        getCmsIntakeSettings: () => {},
        updateCmsIntakeSettings: () => {},
        regenerateCmsIntakeApiKey: () => {},
        getStorageConfig: () => {},
        updateStorageConfig: () => {},
        disconnectStorage: () => {},
        getSystemDiagnostics: () => {},
        restoreUser: () => {},
        restoreClient: () => {},
        restoreCase: () => {},
        restoreTask: () => {},
        getRetentionPreview: () => {},
      };
    }
    if (request === '../controllers/auth.controller') {
      return {
        getAllUsers,
        createUser,
        activateUser,
        deactivateUser,
      };
    }
    if (request === '../controllers/category.controller') {
      return {
        getCategories,
        createCategory: () => {},
        updateCategory: () => {},
        toggleCategoryStatus: () => {},
        deleteCategory: () => {},
        addSubcategory: () => {},
        updateSubcategory: () => {},
        toggleSubcategoryStatus: () => {},
        deleteSubcategory: () => {},
      };
    }
    if (request === '../controllers/client.controller') {
      return {
        getClients,
        createClient: () => {},
        updateClient: () => {},
        toggleClientStatus: () => {},
        changeLegalName: () => {},
        updateClientFactSheet: () => {},
        uploadFactSheetFile: () => {},
        deleteFactSheetFile: () => {},
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/routes/admin.routes');
  const router = require('../src/routes/admin.routes');
  const statsLayer = router.stack.find((layer) => layer.route?.path === '/stats');
  const clientsLayer = router.stack.find((layer) => layer.route?.path === '/clients');
  const categoriesLayer = router.stack.find((layer) => layer.route?.path === '/categories' && layer.route.methods.get);
  const usersLayer = router.stack.find((layer) => layer.route?.path === '/users' && layer.route.methods.get);
  const resetPasswordLayer = router.stack.find((layer) => layer.route?.path === '/users/:xID/reset-password' && layer.route.methods.post);

  assert.ok(statsLayer, 'admin stats route should exist');
  assert.ok(clientsLayer, 'admin clients route should exist');
  assert.ok(categoriesLayer, 'admin categories route should exist');
  assert.ok(usersLayer, 'admin users route should exist');
  assert.ok(resetPasswordLayer, 'admin reset-password route should exist');

  const statsHandlers = statsLayer.route.stack.map((item) => item.handle);
  const clientHandlers = clientsLayer.route.stack.map((item) => item.handle);
  const categoryHandlers = categoriesLayer.route.stack.map((item) => item.handle);
  const userHandlers = usersLayer.route.stack.map((item) => item.handle);
  const resetPasswordHandlers = resetPasswordLayer.route.stack.map((item) => item.handle);

  assert.deepStrictEqual(
    statsHandlers,
    [authenticate, attachFirmContext, adminStatsGuard, superadminLimiter, getAdminStats],
    'stats route should keep its admin middleware chain'
  );
  assert.deepStrictEqual(
    clientHandlers,
    [authenticate, attachFirmContext, clientViewGuard, userReadLimiter, getClients],
    'clients route should expose firm-scoped client management data'
  );
  assert.deepStrictEqual(
    categoryHandlers,
    [authenticate, attachFirmContext, categoryManageGuard, userReadLimiter, getCategories],
    'admin category reads should use dedicated admin routing with manage permissions'
  );
  assert.deepStrictEqual(
    userHandlers,
    [authenticate, attachFirmContext, userViewGuard, userReadLimiter, getAllUsers],
    'admin user listing should live under /api/admin/users'
  );
  assert.deepStrictEqual(
    resetPasswordHandlers,
    [authenticate, attachFirmContext, userManageGuard, sensitiveLimiter, sendUserPasswordReset],
    'admin reset password should use firm-scoped user manage protection'
  );

  console.log('  ✓ exposes admin-scoped client, category, and user routes alongside /api/admin/stats');
}

function testBackendAndFrontendApiAliases() {
  const healthRouteSource = fs.readFileSync(require.resolve('../src/app/routes/mountHealthRoutes.js'), 'utf8');
  const adminApiSource = fs.readFileSync(require.resolve('../ui/src/api/admin.api.js'), 'utf8');
  const categoryServiceSource = fs.readFileSync(require.resolve('../ui/src/services/categoryService.js'), 'utf8');

  assert.ok(
    healthRouteSource.includes("app.get('/api/system/health', apiHealth);"),
    'server should expose /api/system/health as an alias to the API health controller'
  );
  assert.ok(
    adminApiSource.includes("http.get('/admin/clients'"),
    'admin API should load admin clients through /api/admin/clients'
  );
  assert.ok(
    adminApiSource.includes("http.get(`/admin/users"),
    'admin API should load user management through /api/admin/users'
  );
  assert.ok(
    categoryServiceSource.includes("api.get('/admin/categories'"),
    'category service should use /api/admin/categories for admin category data'
  );
  assert.ok(
    adminApiSource.includes("http.post('/admin/users'"),
    'admin API should create users through /api/admin/users'
  );

  console.log('  ✓ keeps system health and admin API paths aligned');
}

async function run() {
  try {
    await testAdminRoutesExposeClientManagement();
    testBackendAndFrontendApiAliases();
    console.log('Admin panel API route tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error('admin panel API route tests failed:', error);
  process.exit(1);
});
