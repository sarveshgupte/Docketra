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
  const adminStatsGuard = () => {};
  const superadminLimiter = () => {};
  const userReadLimiter = () => {};
  const userWriteLimiter = () => {};
  const getAdminStats = () => {};
  const getClients = () => {};
  const permissionGuards = {
    ADMIN_STATS: adminStatsGuard,
    CLIENT_VIEW: clientViewGuard,
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
      };
    }
    if (request === '../middleware/rateLimiters') {
      return { superadminLimiter, userReadLimiter, userWriteLimiter };
    }
    if (request === '../controllers/admin.controller') {
      return {
        getAdminStats,
        resendInviteEmail: () => {},
        getAllOpenCases: () => {},
        getAllPendingCases: () => {},
        getAllFiledCases: () => {},
        getAllResolvedCases: () => {},
        updateRestrictedClients: () => {},
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
    if (request === '../controllers/client.controller') {
      return { getClients };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/routes/admin.routes');
  const router = require('../src/routes/admin.routes');
  const statsLayer = router.stack.find((layer) => layer.route?.path === '/stats');
  const clientsLayer = router.stack.find((layer) => layer.route?.path === '/clients');

  assert.ok(statsLayer, 'admin stats route should exist');
  assert.ok(clientsLayer, 'admin clients route should exist');

  const statsHandlers = statsLayer.route.stack.map((item) => item.handle);
  const clientHandlers = clientsLayer.route.stack.map((item) => item.handle);

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

  console.log('  ✓ exposes /api/admin/clients alongside /api/admin/stats');
}

function testBackendAndFrontendApiAliases() {
  const serverSource = fs.readFileSync(require.resolve('../src/server.js'), 'utf8');
  const adminServiceSource = fs.readFileSync(require.resolve('../ui/src/services/adminService.js'), 'utf8');

  assert.ok(
    serverSource.includes("app.get('/api/system/health', apiHealth);"),
    'server should expose /api/system/health as an alias to the API health controller'
  );
  assert.ok(
    adminServiceSource.includes("api.get('/admin/clients'"),
    'admin service should load admin clients through /api/admin/clients'
  );

  console.log('  ✓ keeps system health and admin client API paths aligned');
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
