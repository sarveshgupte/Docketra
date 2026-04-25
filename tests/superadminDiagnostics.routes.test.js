#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const requireSuperadmin = () => {};
const getSupportDiagnostics = () => {};

Module._load = function(request, parent, isMain) {
  if (request === '../middleware/requestValidation.middleware') {
    return { applyRouteValidation: (router) => router };
  }
  if (request === '../schemas/superadmin.routes.schema.js') {
    return {};
  }
  if (request === '../middleware/permission.middleware') {
    return { requireSuperadmin };
  }
  if (request === '../middleware/authorize') {
    return { authorize: () => (() => {}) };
  }
  if (request === '../policies/superadmin.policy') {
    return { canViewPlatformStats: () => true };
  }
  if (request === '../policies/firm.policy') {
    return {
      canCreate: () => true,
      canView: () => true,
      canManageStatus: () => true,
      canCreateAdmin: () => true,
      canResendAdminAccess: () => true,
    };
  }
  if (request === '../middleware/rateLimiters') {
    return {
      superadminLimiter: () => {},
      superadminAdminResendLimiter: () => {},
      superadminAdminLifecycleLimiter: () => {},
      superadminAdminManagementLimiter: () => {},
    };
  }
  if (request === '../controllers/superadmin.controller') {
    return {
      createFirm: () => {},
      listFirms: () => {},
      updateFirmStatus: () => {},
      createFirmAdmin: () => {},
      listFirmAdmins: () => {},
      resendAdminAccess: () => {},
      getFirmAdminDetails: () => {},
      deleteFirmAdmin: () => {},
      updateFirmAdminStatus: () => {},
      forceResetFirmAdmin: () => {},
      getPlatformStats: () => {},
      disableFirmImmediately: () => {},
      getOperationalHealth: () => {},
      switchFirm: () => {},
      exitFirm: () => {},
      activateFirm: () => {},
      deactivateFirm: () => {},
      getOnboardingInsights: () => {},
      getOnboardingInsightDetails: () => {},
      getOnboardingAlerts: () => {},
      getSupportDiagnostics,
    };
  }

  return originalLoad.apply(this, arguments);
};

try {
  delete require.cache[require.resolve('../src/routes/superadmin.routes')];
  const router = require('../src/routes/superadmin.routes');
  const diagnosticsLayer = router.stack.find((layer) => layer.route?.path === '/diagnostics' && layer.route.methods.get);

  assert.ok(diagnosticsLayer, 'GET /diagnostics route should exist on superadmin router');
  const handlers = diagnosticsLayer.route.stack.map((item) => item.handle);
  assert.strictEqual(handlers[0], requireSuperadmin, 'GET /diagnostics must enforce requireSuperadmin middleware');
  assert.strictEqual(handlers[1], getSupportDiagnostics, 'GET /diagnostics should map to support diagnostics controller');

  console.log('superadminDiagnostics.routes.test.js passed');
} finally {
  Module._load = originalLoad;
}
