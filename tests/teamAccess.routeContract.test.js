#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const createAppModulePath = require.resolve('../src/app/createApp');
const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const adminControllerModulePath = require.resolve('../src/controllers/admin.controller');
const workbasketControllerModulePath = require.resolve('../src/controllers/workbasket.controller');
const userControllerModulePath = require.resolve('../src/controllers/user.controller');
const bcryptModulePath = require.resolve('bcrypt');

const restore = [];
const swapModule = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  swapModule(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });

  const authGate = (req, res, next) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'missing_token' });
    }
    const requestedRole = String(req.headers['x-test-role'] || 'PRIMARY_ADMIN').toUpperCase();
    req.user = {
      _id: '507f1f77bcf86cd799439012',
      xID: 'X000001',
      role: requestedRole,
      firmId: '507f1f77bcf86cd799439011',
    };
    return next();
  };

  const tenantGate = (req, res, next) => {
    if (req.headers['x-test-missing-firm-context'] === '1') {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }
    req.firm = { id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011', firmSlug: 'acme' };
    return next();
  };

  swapModule(routeGroupsModulePath, {
    firmAuthenticatedAccess: [authGate, tenantGate],
    firmReadAccess: [authGate, tenantGate],
    firmWriteAccess: [authGate, tenantGate],
    firmSensitiveAccess: [authGate, tenantGate],
    adminBaseAccess: [authGate, tenantGate],
    tenantScopedApiAccess: [authGate, tenantGate, (_req, _res, next) => next(), (_req, _res, next) => next(), (_req, _res, next) => next()],
    adminTenantScopedApiAccess: [
      authGate,
      tenantGate,
      (_req, _res, next) => next(),
      (_req, _res, next) => next(),
      (_req, _res, next) => next(),
      (req, res, next) => ['PRIMARY_ADMIN', 'ADMIN'].includes(String(req.user?.role || '').toUpperCase())
        ? next()
        : res.status(403).json({ success: false, message: 'Admin role required' }),
    ],
  });

  const originalPermission = require(permissionMiddlewareModulePath);
  swapModule(permissionMiddlewareModulePath, {
    ...originalPermission,
    requireAdmin: (req, res, next) => ['PRIMARY_ADMIN', 'ADMIN'].includes(String(req.user?.role || '').toUpperCase())
      ? next()
      : res.status(403).json({ success: false, message: 'Admin role required' }),
    authorizeFirmPermission: () => (_req, _res, next) => next(),
  });

  const noop = (_req, res) => res.status(200).json({ success: true });
  swapModule(authControllerModulePath, new Proxy({
    getAllUsers: (_req, res) => res.status(200).json({ success: true, data: [] }),
  }, { get: (target, prop) => target[prop] || noop }));

  swapModule(adminControllerModulePath, new Proxy({
    getAdminStats: (_req, res) => res.status(200).json({ success: true, data: { totalUsers: 0, totalClients: 0, totalCategories: 0 } }),
    getHierarchyTree: (_req, res) => res.status(200).json({ success: true, data: [] }),
  }, { get: (target, prop) => target[prop] || noop }));

  swapModule(workbasketControllerModulePath, {
    listWorkbaskets: (_req, res) => res.status(200).json({ success: true, data: [] }),
    getCoreWork: (_req, res) => res.status(200).json({ success: true, data: [] }),
    createDefaultRouting: noop,
    createWorkbasket: noop,
    renameWorkbasket: noop,
    toggleWorkbasketStatus: noop,
    updateUserWorkbaskets: noop,
    addQcMember: noop,
  });

  swapModule(userControllerModulePath, new Proxy({}, { get: () => noop }));

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const endpoints = ['/api/admin/stats', '/api/admin/users', '/api/admin/workbaskets', '/api/admin/hierarchy'];

  for (const role of ['PRIMARY_ADMIN', 'ADMIN']) {
    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint).set('Authorization', 'Bearer valid').set('x-test-role', role);
      assert.strictEqual(response.status, 200, `${role} ${endpoint} should return 200`);
      assert.notStrictEqual(response.status, 404, `${role} ${endpoint} should not be route-level 404`);
      assert.notStrictEqual(response.status, 500, `${role} ${endpoint} should not be 500`);
      assert.notStrictEqual(response.body?.message, 'missing_token', `${role} ${endpoint} should not be missing_token`);

      if (endpoint === '/api/admin/stats') {
        assert.strictEqual(response.body?.success, true, 'stats should return success true');
        assert.strictEqual(typeof response.body?.data, 'object', 'stats should include data object');
      } else {
        assert.strictEqual(response.body?.success, true, `${endpoint} should return success true`);
        assert.ok(Array.isArray(response.body?.data), `${endpoint} should return empty-safe list data`);
      }
    }
  }

  for (const endpoint of endpoints) {
    const missingTokenResponse = await request(app).get(endpoint);
    assert.strictEqual(missingTokenResponse.status, 401, `${endpoint} missing token should return 401`);
  }

  for (const endpoint of endpoints) {
    const missingFirmContextResponse = await request(app)
      .get(endpoint)
      .set('Authorization', 'Bearer valid')
      .set('x-test-role', 'PRIMARY_ADMIN')
      .set('x-test-missing-firm-context', '1');
    assert.ok([400, 401, 403].includes(missingFirmContextResponse.status), `${endpoint} missing firm context should fail closed`);
  }

  console.log('teamAccess.routeContract.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[createAppModulePath];
});
