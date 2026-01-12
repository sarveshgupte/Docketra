#!/usr/bin/env node
/**
 * Firm-scoped RBAC hardening tests (middleware-level)
 * Uses stubbed models to avoid DB dependency.
 */

const assert = require('assert');
const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const { attachFirmContext } = require('../src/middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../src/middleware/permission.middleware');

const OBJECT_ID_A = '507f1f77bcf86cd799439011';
const OBJECT_ID_B = '507f1f77bcf86cd799439012';

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
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => ({ _id: OBJECT_ID_A, firmSlug: 'firm-a', status: 'ACTIVE' });

  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: { firmId: OBJECT_ID_B },
    user: { role: 'Admin' },
  };

  const { res, nextCalled } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, 403, 'JWT firm mismatch should be rejected');
  assert.strictEqual(nextCalled, false, 'Middleware should not continue on mismatch');
  console.log('✓ JWT firm mismatch is rejected');

  Firm.findOne = originalFindOne;
}

async function shouldBlockDisabledFirm() {
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => ({ _id: OBJECT_ID_A, firmSlug: 'firm-a', status: 'SUSPENDED' });

  const req = {
    params: { firmId: OBJECT_ID_A },
    jwt: { firmId: OBJECT_ID_A },
    user: { role: 'Admin' },
  };

  const { res } = await runMiddleware(attachFirmContext, req);
  assert.strictEqual(res.statusCode, 403, 'Disabled firm should block access');
  console.log('✓ Disabled firm blocks access');

  Firm.findOne = originalFindOne;
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
  User.findOne = async (filter) => {
    if (filter.firmId === 'firm-a') {
      return { _id: filter._id, role: 'Admin', isActive: true, firmId: 'firm-a' };
    }
    return null;
  };

  const guard = authorizeFirmPermission('CASE_VIEW');
  const req = {
    firm: { id: 'firm-b' },
    userId: 'user-123',
    user: { _id: 'user-123', role: 'Admin' },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(res.statusCode, 403, 'User should not access another firm');
  assert.strictEqual(nextCalled, false);
  console.log('✓ User cannot access another firm’s cases');

  User.findOne = originalFindOne;
}

async function shouldNotAllowAdminToEscalateToSuperadmin() {
  const originalFindOne = User.findOne;
  User.findOne = async (filter) => ({ _id: filter._id, role: 'Admin', isActive: true, firmId: filter.firmId });

  const guard = authorizeFirmPermission('ADMIN_STATS');
  const req = {
    firm: { id: 'firm-a' },
    userId: 'user-999',
    user: { _id: 'user-999', role: 'Admin' },
    jwt: { role: 'SuperAdmin' },
  };

  const { res, nextCalled } = await runMiddleware(guard, req);
  assert.strictEqual(res.statusCode, null, 'Admin should be evaluated by firm membership, not JWT role');
  assert.strictEqual(nextCalled, true, 'Guard should allow Admin based on firm role');
  assert.strictEqual(req.firmRole, 'Admin', 'Resolved firm role should remain Admin');
  console.log('✓ Admin cannot escalate to SuperAdmin via JWT claims');

  User.findOne = originalFindOne;
}

async function run() {
  await shouldRejectJwtFirmMismatch();
  await shouldBlockDisabledFirm();
  await shouldBlockSuperadminFromFirmRoutes();
  await shouldDenyCrossFirmMembership();
  await shouldNotAllowAdminToEscalateToSuperadmin();
  console.log('\nFirm-scoped RBAC middleware tests completed.');
}

run().catch((err) => {
  console.error('Firm RBAC tests failed:', err);
  process.exit(1);
});
