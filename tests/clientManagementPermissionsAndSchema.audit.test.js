#!/usr/bin/env node
const assert = require('assert');
const User = require('../src/models/User.model');
const { buildRoleContext } = require('../src/services/authorization.service');
const { authorizeFirmPermission } = require('../src/middleware/permission.middleware');
const clientRouteSchema = require('../src/schemas/client.routes.schema');

const createRes = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

(async () => {
  // Role hierarchy access checks
  for (const role of ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']) {
    const ctx = buildRoleContext(role);
    assert(ctx.permissions.includes('CLIENT_MANAGE'), `${role} must include CLIENT_MANAGE`);
  }
  const userCtx = buildRoleContext('USER');
  assert(!userCtx.permissions.includes('CLIENT_MANAGE'), 'USER must not include CLIENT_MANAGE by default');

  // Permission middleware denial copy check for client-manage
  const originalFindOne = User.findOne;
  User.findOne = async () => ({ _id: 'u-1', role: 'USER', isActive: true, firmId: 'firm-1' });
  const req = { user: { role: 'USER', _id: 'u-1', firmId: 'firm-1' }, firm: { id: 'firm-1' }, userId: 'u-1' };
  const res = createRes();
  let nextCalled = false;
  await authorizeFirmPermission('CLIENT_MANAGE')(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false, 'Unauthorized mutation must be blocked');
  assert.equal(res.statusCode, 403, 'Unauthorized mutation must return 403');
  assert.equal(res.body.message, 'Client management access is required', 'CLIENT_MANAGE denial message should be specific');
  User.findOne = originalFindOne;

  // Update schema should accept canonical client fields
  const putSchema = clientRouteSchema['PUT /:clientId'].body;
  const parsed = putSchema.parse({
    businessName: 'Acme Pvt Ltd',
    businessEmail: 'ops@acme.com',
    primaryContactNumber: '9999999999',
    businessAddress: 'Address 1',
    PAN: 'abcde1234f',
    CIN: 'l12345mh2020plc000001',
    TAN: 'blra12345b',
    GST: '22abcde1234f1z5',
    contactPersonName: 'Jane Doe',
  });
  assert.equal(parsed.PAN, 'abcde1234f');

  console.log('clientManagementPermissionsAndSchema.audit.test.js passed');
})();
