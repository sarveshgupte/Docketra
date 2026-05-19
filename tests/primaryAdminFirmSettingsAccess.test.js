#!/usr/bin/env node
const assert = require('assert');
const User = require('../src/models/User.model');
const { authorizeFirmPermission, requireAdmin } = require('../src/middleware/permission.middleware');
const { ROLE_PERMISSIONS } = require('../src/services/authorization.service');

const createRes = () => ({ statusCode: null, body: null, status(code){ this.statusCode = code; return this; }, json(payload){ this.body = payload; return this; } });
const run = async (mw, req) => {
  const res = createRes();
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

(async () => {
  assert.ok(ROLE_PERMISSIONS.PRIMARY_ADMIN.includes('SLA_RULES_MANAGE'));
  assert.ok(ROLE_PERMISSIONS.PRIMARY_ADMIN.includes('FIRM_SETTINGS_MANAGE'));

  const originalFindOne = User.findOne;
  User.findOne = async (query) => ({ _id: query._id || 'u1', xID: 'X000001', role: 'PRIMARYADMIN', isActive: true, firmId: query.firmId, permissions: [] });

  const req = { user: { _id: 'u1', xID: 'X000001', role: 'PRIMARYADMIN', firmId: 'firm-1' }, firm: { id: 'firm-1' }, tenant: { id: 'firm-1' } };
  const adminResult = await run(requireAdmin, req);
  assert.strictEqual(adminResult.nextCalled, true, 'PRIMARY_ADMIN alias should pass requireAdmin');

  const settingsResult = await run(authorizeFirmPermission(['FIRM_SETTINGS_MANAGE', 'ADMIN_STATS']), req);
  assert.strictEqual(settingsResult.nextCalled, true, 'PRIMARY_ADMIN should pass firm settings permission guard');

  const slaResult = await run(authorizeFirmPermission(['SLA_RULES_MANAGE', 'ADMIN_STATS']), req);
  assert.strictEqual(slaResult.nextCalled, true, 'PRIMARY_ADMIN should pass SLA permission guard');

  User.findOne = async (query) => ({ _id: query._id || 'u2', xID: 'X000002', role: 'USER', isActive: true, firmId: query.firmId, permissions: [] });
  const deniedResult = await run(authorizeFirmPermission(['FIRM_SETTINGS_MANAGE', 'ADMIN_STATS']), { user: { _id: 'u2', role: 'USER', firmId: 'firm-1' }, userId: 'u2', firm: { id: 'firm-1' } });
  assert.strictEqual(deniedResult.res.statusCode, 403, 'non-admin user should still receive 403');

  User.findOne = originalFindOne;
  console.log('✓ PRIMARY_ADMIN permission regression coverage passed');
})();
