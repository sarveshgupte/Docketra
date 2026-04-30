#!/usr/bin/env node
/**
 * Firm-scoped RBAC hardening tests (middleware-level)
 * Uses stubbed models to avoid DB dependency.
 */

const assert = require('assert');
const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const Client = require('../src/models/Client.model');
const { attachFirmContext } = require('../src/middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../src/middleware/permission.middleware');
const requireTenant = require('../src/middleware/requireTenant');

const OBJECT_ID_A = '507f1f77bcf86cd799439011';
const OBJECT_ID_B = '507f1f77bcf86cd799439012';
const FIRM_KEY_A = 'firm-a';
const FIRM_KEY_B = 'firm-b';

const createRes = () => {
  return {
    statusCode: null,
    body: null,
    sent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.sent = true;
      return this;
    },
  };
};

const runMiddleware = async (mw, req) => {
  const res = createRes();
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

async function shouldRejectJwtFirmMismatch() {
  const originalFindById = Firm.findById;
  const originalClientFindOne = Client.findOne;
  Firm.findById = () => ({ lean: () => Promise.resolve({ _id: OBJECT_ID_A, firmSlug: 'firm-a', status: 'ACTIVE' }) });
  Client.findOne = () => ({ lean: () => Promise.resolve(null) });

  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: { firmId: OBJECT_ID_B },
    user: { role: 'Admin' },
  };

  const { res, nextCalled } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, 403, 'JWT firm mismatch should be rejected');
  assert.strictEqual(nextCalled, false, 'Middleware should not continue on mismatch');
  console.log('✓ JWT firm mismatch is rejected');

  Firm.findById = originalFindById;
  Client.findOne = originalClientFindOne;
}

async function shouldBlockDisabledFirm() {
  const originalFindById = Firm.findById;
  const originalClientFindOne = Client.findOne;
  Firm.findById = () => ({ lean: () => Promise.resolve({ _id: OBJECT_ID_A, firmSlug: 'firm-a', status: 'SUSPENDED' }) });
  Client.findOne = () => ({ lean: () => Promise.resolve(null) });

  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: { firmId: OBJECT_ID_A },
    user: { role: 'Admin' },
  };

  const { res } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, 403, 'Disabled firm should block access');
  console.log('✓ Disabled firm blocks access');

  Firm.findById = originalFindById;
  Client.findOne = originalClientFindOne;
}

async function shouldAllowActiveFirmRegardlessOfStatusCase() {
  const originalFindById = Firm.findById;
  const originalClientFindOne = Client.findOne;
  Firm.findById = () => ({ lean: () => Promise.resolve({ _id: OBJECT_ID_A, firmSlug: 'firm-a', status: 'ACTIVE' }) });
  Client.findOne = () => ({ lean: () => Promise.resolve(null) });

  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: { firmId: OBJECT_ID_A },
    user: { role: 'Admin' },
  };

  const { res, nextCalled } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, null, 'Uppercase ACTIVE status should still be treated as active');
  assert.strictEqual(nextCalled, true, 'Middleware should continue for active firms regardless of status casing');
  assert.strictEqual(req.firmId, OBJECT_ID_A, 'Firm context should still be attached');
  console.log('✓ Uppercase ACTIVE firm status is accepted');

  Firm.findById = originalFindById;
  Client.findOne = originalClientFindOne;
}

async function shouldBlockSuperadminFromFirmRoutes() {
  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: {},
    user: { role: 'SuperAdmin' },
  };

  const { res, nextCalled } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, 403, 'Superadmin must be blocked from firm-scoped routes');
  assert.strictEqual(nextCalled, false);
  console.log('✓ Superadmin bypass does not leak firm context');
}

async function shouldDenyCrossFirmMembership() {
  const originalFindOne = User.findOne;
  let requestedFirmId = null;
  User.findOne = async (filter) => {
    requestedFirmId = filter.firmId;
    if (filter.firmId === FIRM_KEY_A) {
      return { _id: filter._id, role: 'Admin', isActive: true, firmId: FIRM_KEY_A };
    }
    return null;
  };

  const guard = authorizeFirmPermission('CASE_VIEW');
  const req = {
    firm: { id: FIRM_KEY_B },
    userId: 'user-123',
    user: { _id: 'user-123', role: 'Admin' },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(requestedFirmId, FIRM_KEY_B, 'Permission check must enforce the requested firm');
  assert.strictEqual(res.statusCode, 403, 'User should not access another firm');
  assert.strictEqual(nextCalled, false);
  console.log('✓ User cannot access another firm’s cases');

  User.findOne = originalFindOne;
}

async function shouldUseCachedRoleWithoutDbLookup() {
  const originalFindOne = User.findOne;
  let findOneCalls = 0;
  User.findOne = async () => {
    findOneCalls += 1;
    throw new Error('DB lookup should not run when firm role is cached on the request');
  };

  const guard = authorizeFirmPermission('CASE_VIEW');
  const req = {
    firm: { id: FIRM_KEY_A },
    userId: 'user-321',
    user: { _id: 'user-321', role: 'ADMIN', firmId: FIRM_KEY_A },
    jwt: { role: 'ADMIN', firmId: FIRM_KEY_A },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(res.statusCode, null, 'Cached firm role should authorize the request');
  assert.strictEqual(nextCalled, true, 'Guard should continue when cached role grants access');
  assert.strictEqual(findOneCalls, 0, 'Cached request role should avoid membership DB lookups');
  assert.strictEqual(req.firmRole, 'ADMIN', 'Cached request role should be attached to the request');
  assert.ok(req.firmPermissions.includes('CASE_VIEW'), 'Cached request role should resolve permissions');
  console.log('✓ Cached request role bypasses membership DB lookup');

  User.findOne = originalFindOne;
}

async function shouldFallbackToDbLookupWhenCachedRoleMissing() {
  const originalFindOne = User.findOne;
  let findOneCalls = 0;
  User.findOne = async (filter) => {
    findOneCalls += 1;
    return { _id: filter._id, role: 'ADMIN', isActive: true, firmId: filter.firmId };
  };

  const guard = authorizeFirmPermission('ADMIN_STATS');
  const req = {
    firm: { id: FIRM_KEY_A },
    userId: 'user-654',
    user: { _id: 'user-654', firmId: FIRM_KEY_A },
    jwt: { firmId: FIRM_KEY_A },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(res.statusCode, null, 'Missing cached role should fall back to membership lookup');
  assert.strictEqual(nextCalled, true, 'Guard should continue after DB fallback succeeds');
  assert.strictEqual(findOneCalls, 1, 'DB fallback should run once when role is missing');
  assert.strictEqual(req.firmRole, 'ADMIN', 'Fallback membership role should be attached to the request');
  console.log('✓ Missing cached role falls back to membership DB lookup');

  User.findOne = originalFindOne;
}

async function shouldNotAllowAdminToEscalateToSuperadmin() {
  const originalFindOne = User.findOne;
  let findOneCalls = 0;
  User.findOne = async () => {
    findOneCalls += 1;
    throw new Error('Escalation check should use cached firm role');
  };

  const guard = authorizeFirmPermission('ADMIN_STATS');
  const req = {
    firm: { id: 'firm-a' },
    userId: 'user-999',
    user: { _id: 'user-999', role: 'Admin', firmId: 'firm-a' },
    jwt: { role: 'SuperAdmin' },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(res.statusCode, null, 'Admin should be evaluated by firm membership, not JWT role');
  assert.strictEqual(nextCalled, true, 'Guard should allow Admin based on firm role');
  assert.strictEqual(findOneCalls, 0, 'Guard should not query membership when request role is already trusted');
  assert.strictEqual(req.jwt.role, 'SuperAdmin', 'Test should preserve the elevated JWT claim to verify it is ignored');
  assert.notStrictEqual(req.firmRole, req.jwt.role, 'Guard should ignore the SuperAdmin JWT claim for firm authorization');
  assert.strictEqual(req.firmRole, 'Admin', 'Resolved firm role should remain Admin');
  console.log('✓ Admin cannot escalate to SuperAdmin via JWT claims');

  User.findOne = originalFindOne;
}

async function shouldRejectMissingTenantContext() {
  const req = { user: { role: 'Admin' } };
  const { res, nextCalled } = await runMiddleware(requireTenant, req);
  assert.strictEqual(res.statusCode, 400, 'Missing tenant context should return 400');
  assert.strictEqual(res.body.error, 'Tenant context missing. Request rejected.');
  assert.strictEqual(nextCalled, false, 'Middleware should block request without tenant');
  console.log('✓ Missing tenant context is rejected');
}

async function shouldRejectLegacyFirmIdFallback() {
  const req = { firmId: 'legacy-firm-id-only' };
  const { res, nextCalled } = await runMiddleware(requireTenant, req);
  assert.strictEqual(res.statusCode, 400, 'Legacy firmId-only context should be rejected');
  assert.strictEqual(res.body.error, 'Tenant context missing. Request rejected.');
  assert.strictEqual(nextCalled, false, 'Middleware should not fall back to req.firmId');
  console.log('✓ Legacy req.firmId fallback is rejected');
}

async function run() {
  await shouldRejectJwtFirmMismatch();
  await shouldBlockDisabledFirm();
  await shouldAllowActiveFirmRegardlessOfStatusCase();
  await shouldBlockSuperadminFromFirmRoutes();
  await shouldDenyCrossFirmMembership();
  await shouldUseCachedRoleWithoutDbLookup();
  await shouldFallbackToDbLookupWhenCachedRoleMissing();
  await shouldNotAllowAdminToEscalateToSuperadmin();
  await shouldRejectMissingTenantContext();
  await shouldRejectLegacyFirmIdFallback();
  console.log('\nFirm-scoped RBAC middleware tests completed.');
}

run().catch((err) => {
  console.error('Firm RBAC tests failed:', err);
  process.exit(1);
});
