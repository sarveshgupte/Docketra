#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const requireSuperadmin = () => {};
const getSuperadminAuditLogs = () => {};
Module._load = function(request, parent, isMain) {
  if (request === '../middleware/requestValidation.middleware') return { applyRouteValidation: (router) => router };
  if (request === '../middleware/permission.middleware') return { requireSuperadmin };
  if (request === '../middleware/authorize') return { authorize: () => (() => {}) };
  if (request === '../policies/superadmin.policy') return { canViewPlatformStats: () => true };
  if (request === '../policies/firm.policy') return { canCreate:()=>true, canView:()=>true, canManageStatus:()=>true, canCreateAdmin:()=>true, canResendAdminAccess:()=>true };
  if (request === '../middleware/rateLimiters') return { superadminLimiter:()=>{}, superadminAdminResendLimiter:()=>{}, superadminAdminLifecycleLimiter:()=>{}, superadminAdminManagementLimiter:()=>{} };
  if (request === '../controllers/superadmin.controller') return { createFirm(){}, listFirms(){}, updateFirmStatus(){}, createFirmAdmin(){}, listFirmAdmins(){}, resendAdminAccess(){}, getFirmAdminDetails(){}, deleteFirmAdmin(){}, updateFirmAdminStatus(){}, forceResetFirmAdmin(){}, disableFirmImmediately(){}, getOperationalHealth(){}, switchFirm(){}, exitFirm(){}, activateFirm(){}, deactivateFirm(){}, getSupportDiagnostics(){}, getFirmHealth(){}, getPlatformStats(){}, getOnboardingInsights(){}, getOnboardingInsightDetails(){}, getOnboardingAlerts(){}, getSuperadminAuditLogs, getSuperadminGlobalSearch(){} };
  return originalLoad.apply(this, arguments);
};
try {
  delete require.cache[require.resolve('../src/routes/superadmin.routes')];
  const router = require('../src/routes/superadmin.routes');
  const layer = router.stack.find((item) => item.route?.path === '/audit-logs' && item.route.methods.get);
  assert.ok(layer, 'GET /audit-logs should exist');
  const handlers = layer.route.stack.map((item) => item.handle);
  assert.strictEqual(handlers[0], requireSuperadmin, 'GET /audit-logs must enforce requireSuperadmin');
  assert.strictEqual(handlers[handlers.length - 1], getSuperadminAuditLogs, 'GET /audit-logs maps to audit controller');
  console.log('superadminAuditLogs.routes.test.js passed');
} finally { Module._load = originalLoad; }
