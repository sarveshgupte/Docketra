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
  for (const role of ['PRIMARY_ADMIN', 'ADMIN']) {
    const ctx = buildRoleContext(role);
    assert(ctx.permissions.includes('CLIENT_MANAGE'), `${role} must include CLIENT_MANAGE`);
  }
  const managerCtx = buildRoleContext('MANAGER');
  assert(!managerCtx.permissions.includes('CLIENT_MANAGE'), 'MANAGER must not include CLIENT_MANAGE by default');
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
  assert.equal(res.body.message, 'Client management requires Admin access.', 'CLIENT_MANAGE denial message should be specific');
  User.findOne = originalFindOne;

  // Update schema should accept canonical client fields
  const putSchema = clientRouteSchema['PUT /:clientId'].body;
  const parsed = putSchema.parse({
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    contactPersonEmail: 'jane@acme.com',
    contactPersonPhone: '9999999998',
    businessName: 'Acme Pvt Ltd',
    businessEmail: 'ops@acme.com',
    primaryContactNumber: '9999999999',
    businessAddress: 'Address 1',
    PAN: 'abcde1234f',
    CIN: 'l12345mh2020plc000001',
    TAN: 'blra12345b',
    GST: '22abcde1234f1z5',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    contactPersonName: 'Jane Doe',
    contactPersonEmail: 'jane@acme.com',
    contactPersonPhone: '9999999998',
  });
  assert.equal(parsed.PAN, 'abcde1234f');

  // Create schema should require businessName and support canonical optional fields
  const postSchema = clientRouteSchema['POST /'].body;

  assert.throws(() => postSchema.parse({ businessName: 'Pranali Ltd' }), /businessEmail|primaryContactNumber|businessAddress|city|state|pincode|contactPersonName|contactPersonEmail|contactPersonPhone/i);

  assert.throws(
    () => postSchema.parse({}),
    /businessName/i,
    'POST / schema must reject payloads without businessName'
  );

  const createFull = postSchema.parse({
    businessName: 'Acme Pvt Ltd',
    businessEmail: 'ops@acme.com',
    primaryContactNumber: '9999999999',
    businessAddress: 'Address 1',
    PAN: 'abcde1234f',
    CIN: 'l12345mh2020plc000001',
    TAN: 'blra12345b',
    GST: '22abcde1234f1z5',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    contactPersonName: 'Jane Doe',
    contactPersonEmail: 'jane@acme.com',
    contactPersonPhone: '9999999998',
  });
  assert.equal(createFull.contactPersonName, 'Jane Doe');

  // Status route must match controller contract (isActive boolean) and be strict
  const statusSchema = clientRouteSchema['PATCH /:clientId/status'].body;
  assert.deepStrictEqual(statusSchema.parse({ isActive: true }), { isActive: true });
  assert.deepStrictEqual(statusSchema.parse({ status: 'ACTIVE' }), { status: 'ACTIVE' });
  assert.throws(() => statusSchema.parse({ isActive: true, extra: 'x' }), /unrecognized/i, 'Status schema must reject unknown keys');

  // Change-name route must match controller contract and be strict
  const changeNameSchema = clientRouteSchema['POST /:clientId/change-name'].body;
  assert.deepStrictEqual(
    changeNameSchema.parse({ newBusinessName: 'Acme Legal LLP', reason: 'Registered legal entity rename' }),
    { newBusinessName: 'Acme Legal LLP', reason: 'Registered legal entity rename' }
  );
  assert.deepStrictEqual(
    changeNameSchema.parse({ legalName: 'Acme Legal LLP', reason: 'Registered legal entity rename' }),
    { legalName: 'Acme Legal LLP', reason: 'Registered legal entity rename' }
  );
  assert.throws(() => changeNameSchema.parse({ newBusinessName: 'Acme', reason: 'Audit', extra: true }), /unrecognized/i, 'Change-name schema must reject unknown keys');

  // Guard against regressions that reintroduce legacy body.name checks in client create path
  const clientControllerSource = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'controllers', 'client.controller.js'), 'utf8');
  assert.equal(
    clientControllerSource.includes('req.body.name'),
    false,
    'Client create/update paths must not require or depend on legacy body.name'
  );
  assert.equal(
    clientControllerSource.includes('const { isActive: rawIsActive, status } = req.body;'),
    true,
    'Controller status mutation should accept isActive and status payloads'
  );
  assert.equal(
    clientControllerSource.includes('const { newBusinessName: rawNewBusinessName, legalName, reason } = req.body;'),
    true,
    'Change-name controller should accept newBusinessName and legalName aliases'
  );

  console.log('clientManagementPermissionsAndSchema.audit.test.js passed');
})();
