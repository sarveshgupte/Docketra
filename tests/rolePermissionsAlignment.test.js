#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'y'.repeat(80);
process.env.METRICS_TOKEN = process.env.METRICS_TOKEN || 'z'.repeat(80);
process.env.REDIS_URL = '';
process.env.ALLOW_REDIS_FALLBACK = 'true';

const assert = require('node:assert/strict');
const request = require('supertest');

const { buildRoleContext } = require('../src/services/authorization.service');
const docketraIntelligenceService = require('../src/services/docketraIntelligence.service');
const User = require('../src/models/User.model');

const createMockRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

async function testRolePermissionMatrices() {
  const adminCtx = buildRoleContext('ADMIN');
  assert.ok(adminCtx.permissions.includes('WORKBASKET_MANAGE'), 'ADMIN must include WORKBASKET_MANAGE');

  const managerCtx = buildRoleContext('MANAGER');
  assert.ok(managerCtx.permissions.includes('CASE_ASSIGN'), 'MANAGER must include CASE_ASSIGN');
  assert.ok(!managerCtx.permissions.includes('CLIENT_MANAGE'), 'MANAGER must remain read-only on CLIENT_MANAGE');
  console.log('✓ role permission matrices aligned');
}

async function testDocketraIntelligenceRoleGuards() {
  const origBrief = docketraIntelligenceService.generateExecutiveAiBrief;
  const origRisk = docketraIntelligenceService.getClientComplianceRiskScores;

  try {
    docketraIntelligenceService.generateExecutiveAiBrief = async () => ({ headline: 'OK' });
    docketraIntelligenceService.getClientComplianceRiskScores = async () => ([{ clientId: 'C000001', score: 10 }]);

    delete require.cache[require.resolve('../src/controllers/docketraIntelligence.controller')];
    const controller = require('../src/controllers/docketraIntelligence.controller');

    const userReq = { user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' }, query: {} };
    const briefDeniedRes = createMockRes();
    await controller.getExecutiveBrief(userReq, briefDeniedRes);
    assert.strictEqual(briefDeniedRes.statusCode, 403);
    assert.strictEqual(briefDeniedRes.payload.success, false);

    const riskDeniedRes = createMockRes();
    await controller.getClientRiskScores(userReq, riskDeniedRes);
    assert.strictEqual(riskDeniedRes.statusCode, 403);
    assert.strictEqual(riskDeniedRes.payload.success, false);

    for (const role of ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN']) {
      const allowedReq = { user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X999999' }, query: {} };
      const briefRes = createMockRes();
      await controller.getExecutiveBrief(allowedReq, briefRes);
      assert.strictEqual(briefRes.statusCode, 200, `${role} should access executive brief`);
      assert.strictEqual(briefRes.payload.success, true);

      const riskRes = createMockRes();
      await controller.getClientRiskScores(allowedReq, riskRes);
      assert.strictEqual(riskRes.statusCode, 200, `${role} should access client risk scores`);
      assert.strictEqual(riskRes.payload.success, true);
    }

    console.log('✓ docketraIntelligence executive-brief & client-risk enforce MANAGER+');
  } finally {
    docketraIntelligenceService.generateExecutiveAiBrief = origBrief;
    docketraIntelligenceService.getClientComplianceRiskScores = origRisk;
  }
}

async function testAuthStatusControllerRoleBoundaries() {
  const originalFindOne = User.findOne;
  const bcryptModulePath = require.resolve('bcrypt');
  const wrapPath = require.resolve('../src/middleware/wrapWriteHandler');
  const origBcrypt = require.cache[bcryptModulePath];
  const origWrap = require.cache[wrapPath];
  require.cache[bcryptModulePath] = {
    id: bcryptModulePath,
    filename: bcryptModulePath,
    loaded: true,
    exports: { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' },
  };
  require.cache[wrapPath] = { id: wrapPath, filename: wrapPath, loaded: true, exports: (fn) => fn };
  const controllerPath = require.resolve('../src/controllers/auth.controller');
  delete require.cache[controllerPath];
  const authController = require('../src/controllers/auth.controller');

  try {
    // Non-admin receives clean 403 (never 500)
    const staffReq = {
      params: { xID: 'X000010' },
      body: { active: false },
      user: { _id: 'u1', xID: 'X000002', firmId: 'firm-1', role: 'USER' },
    };
    const staffRes = createMockRes();
    await authController.deactivateUser(staffReq, staffRes);
    assert.strictEqual(staffRes.statusCode, 403);
    assert.strictEqual(staffRes.payload.success, false);

    // Non-primary ADMIN cannot modify another ADMIN account
    User.findOne = async () => ({
      _id: 'u2',
      xID: 'X000009',
      firmId: 'firm-1',
      role: 'ADMIN',
      isPrimaryAdmin: false,
      isSystem: false,
    });
    const adminOnAdminReq = {
      params: { xID: 'X000009' },
      body: { active: false },
      user: { _id: 'u3', xID: 'X000005', firmId: 'firm-1', role: 'ADMIN', isPrimaryAdmin: false },
    };
    const adminOnAdminRes = createMockRes();
    await authController.deactivateUser(adminOnAdminReq, adminOnAdminRes);
    assert.strictEqual(adminOnAdminRes.statusCode, 403);
    assert.strictEqual(adminOnAdminRes.payload.success, false);

    console.log('✓ user status lifecycle handlers return 403 cleanly for unauthorized role transitions');
  } finally {
    User.findOne = originalFindOne;
    delete require.cache[controllerPath];
    if (origBcrypt) require.cache[bcryptModulePath] = origBcrypt;
    else delete require.cache[bcryptModulePath];
    if (origWrap) require.cache[wrapPath] = origWrap;
    else delete require.cache[wrapPath];
  }
}

async function testUserControllerCreateRoleGuard() {
  const wrapPath = require.resolve('../src/middleware/wrapWriteHandler');
  const controllerPath = require.resolve('../src/controllers/user.controller');
  const origWrap = require.cache[wrapPath];
  const origController = require.cache[controllerPath];

  try {
    require.cache[wrapPath] = { id: wrapPath, filename: wrapPath, loaded: true, exports: (fn) => fn };
    delete require.cache[controllerPath];
    const { createUser } = require('../src/controllers/user.controller');

    const req = {
      user: { _id: 'mgr-1', firmId: 'firm-1', role: 'MANAGER', primaryAdminId: 'pa-1' },
      body: { name: 'Escalate', email: 'escalate@example.com', role: 'ADMIN' },
    };
    const res = createMockRes();
    await createUser(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.payload.success, false);
    console.log('✓ user.controller.createUser rejects disallowed role escalation');
  } finally {
    if (origWrap) require.cache[wrapPath] = origWrap;
    else delete require.cache[wrapPath];
    if (origController) require.cache[controllerPath] = origController;
    else delete require.cache[controllerPath];
  }
}

async function testAdminWorkbasketMountForManagerAndUser() {
  const restore = [];
  const swapModule = (modulePath, exportsValue) => {
    restore.push({ modulePath, original: require.cache[modulePath] });
    delete require.cache[modulePath];
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
  };

  const createAppModulePath = require.resolve('../src/app/createApp');
  const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
  const authorizationServiceModulePath = require.resolve('../src/services/authorization.service');
  const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
  const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
  const adminControllerModulePath = require.resolve('../src/controllers/admin.controller');
  const workbasketControllerModulePath = require.resolve('../src/controllers/workbasket.controller');
  const userControllerModulePath = require.resolve('../src/controllers/user.controller');
  const bcryptModulePath = require.resolve('bcrypt');

  try {
    swapModule(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });
    const origAuthService = require(authorizationServiceModulePath);
    swapModule(authorizationServiceModulePath, {
      ...origAuthService,
      resolveRequestFirmRole: async (req) => origAuthService.buildRoleContext(req.user?.role),
      resolveFirmRole: async () => null,
    });

    const authGate = (req, res, next) => {
      const requestedRole = String(req.headers['x-test-role'] || 'PRIMARY_ADMIN').toUpperCase();
      req.user = {
        _id: '507f1f77bcf86cd799439012',
        xID: 'X000001',
        role: requestedRole,
        firmId: '507f1f77bcf86cd799439011',
      };
      return next();
    };
    const tenantGate = (req, _res, next) => {
      req.firm = { id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011', firmSlug: 'acme' };
      req.firmId = '507f1f77bcf86cd799439011';
      return next();
    };

    const originalPermission = require(permissionMiddlewareModulePath);
    const originalRouteGroups = require(routeGroupsModulePath);
    swapModule(routeGroupsModulePath, {
      ...originalRouteGroups,
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
        (req, res, next) => (['PRIMARY_ADMIN', 'ADMIN'].includes(String(req.user?.role || '').toUpperCase())
          ? next()
          : res.status(403).json({ success: false, message: 'Admin access required' })),
      ],
    });

    const noop = (_req, res) => res.status(200).json({ success: true, data: [] });
    swapModule(authControllerModulePath, new Proxy({}, { get: () => noop }));
    swapModule(adminControllerModulePath, new Proxy({}, { get: () => noop }));
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

    const managerList = await request(app).get('/api/admin/workbaskets').set('x-test-role', 'MANAGER');
    assert.strictEqual(managerList.status, 200, 'MANAGER should be able to list /api/admin/workbaskets');

    const adminCreate = await request(app)
      .post('/api/admin/workbaskets')
      .set('x-test-role', 'ADMIN')
      .set('Idempotency-Key', 'wb-admin-1')
      .send({ name: 'Tax Desk' });
    assert.strictEqual(adminCreate.status, 200, 'ADMIN should pass WORKBASKET_MANAGE and create workbasket');

    const managerCreate = await request(app)
      .post('/api/admin/workbaskets')
      .set('x-test-role', 'MANAGER')
      .set('Idempotency-Key', 'wb-mgr-1')
      .send({ name: 'GST Desk' });
    assert.strictEqual(managerCreate.status, 200, 'MANAGER should pass /api/admin/workbaskets mount and WORKBASKET_MANAGE');

    const userList = await request(app).get('/api/admin/workbaskets').set('x-test-role', 'USER');
    assert.strictEqual(userList.status, 403, 'USER must be blocked from /api/admin/workbaskets');

    const managerAudit = await request(app).get('/api/admin/audit-logs').set('x-test-role', 'MANAGER');
    assert.strictEqual(managerAudit.status, 403, 'MANAGER must remain blocked from general /api/admin endpoints');

    console.log('✓ /api/admin/workbaskets allows MANAGER/ADMIN and blocks USER without opening /api/admin/*');
  } finally {
    for (const { modulePath, original } of restore) {
      delete require.cache[modulePath];
      if (original) require.cache[modulePath] = original;
    }
    delete require.cache[createAppModulePath];
  }
}

(async () => {
  await testRolePermissionMatrices();
  await testDocketraIntelligenceRoleGuards();
  await testAuthStatusControllerRoleBoundaries();
  await testUserControllerCreateRoleGuard();
  await testAdminWorkbasketMountForManagerAndUser();
  console.log('\nAll role & permission alignment tests passed!');
})().catch((err) => {
  console.error('rolePermissionsAlignment.test.js failed:', err);
  process.exit(1);
});
