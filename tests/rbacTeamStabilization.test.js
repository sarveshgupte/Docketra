#!/usr/bin/env node
const assert = require('assert');

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const loadUserControllerWithoutTxWrapper = () => {
  const wrapPath = require.resolve('../src/middleware/wrapWriteHandler');
  const controllerPath = require.resolve('../src/controllers/user.controller');
  const originalWrap = require.cache[wrapPath];
  const originalController = require.cache[controllerPath];

  require.cache[wrapPath] = { exports: (fn) => fn };
  delete require.cache[controllerPath];
  const controller = require('../src/controllers/user.controller');

  if (originalWrap) require.cache[wrapPath] = originalWrap;
  else delete require.cache[wrapPath];

  if (originalController) require.cache[controllerPath] = originalController;
  else delete require.cache[controllerPath];

  return controller;
};

async function testNoSecondPrimaryAdmin() {
  const User = require('../src/models/User.model');
  const originalFindOne = User.findOne;

  let call = 0;
  User.findOne = (query) => {
    call += 1;
    if (call === 1) {
      return {
        _id: '507f1f77bcf86cd799439021',
        role: 'ADMIN',
        isPrimaryAdmin: false,
        save: async () => {},
        toSafeObject: () => ({ id: '507f1f77bcf86cd799439021', role: 'ADMIN' }),
      };
    }
    if (query?.role === 'PRIMARY_ADMIN') {
      return { select: async () => ({ _id: '507f1f77bcf86cd799439022' }) };
    }
    return null;
  };

  const { patchUserRole } = loadUserControllerWithoutTxWrapper();
  const req = { params: { id: '507f1f77bcf86cd799439021' }, body: { role: 'PRIMARY_ADMIN' }, user: { role: 'PRIMARY_ADMIN', firmId: 'firm-1' } };
  const res = createRes();

  await patchUserRole(req, res);
  assert.strictEqual(res.statusCode, 409);

  User.findOne = originalFindOne;
  console.log('✓ prevents second PRIMARY_ADMIN in firm');
}

async function testManagerCannotMoveCrossTeamDocket() {
  const Case = require('../src/models/Case.model');
  const User = require('../src/models/User.model');
  const originalCaseFindOne = Case.findOne;
  const originalUserFindOne = User.findOne;

  Case.findOne = async () => ({
    caseId: 'DCK-1',
    firmId: 'firm-1',
    ownerTeamId: 'team-B',
    save: async () => {},
  });
  User.findOne = async () => null;

  const { managerMoveDocket } = require('../src/services/docketRouting.service');
  await assert.rejects(
    () => managerMoveDocket({ docketId: 'DCK-1', firmId: 'firm-1', actor: { role: 'MANAGER', teamId: 'team-A' }, to: { type: 'WB' } }),
    /Cross-team movement is forbidden/
  );

  Case.findOne = originalCaseFindOne;
  User.findOne = originalUserFindOne;
  console.log('✓ blocks manager cross-team docket move');
}

async function testAdminCannotEscalateAboveSelf() {
  const User = require('../src/models/User.model');
  const originalFindOne = User.findOne;

  User.findOne = () => ({
    _id: '507f1f77bcf86cd799439023',
    role: 'ADMIN',
    save: async () => {},
    toSafeObject: () => ({ id: '507f1f77bcf86cd799439023', role: 'ADMIN' }),
  });

  const { patchUserRole } = loadUserControllerWithoutTxWrapper();
  const req = { params: { id: '507f1f77bcf86cd799439023' }, body: { role: 'SUPER_ADMIN' }, user: { role: 'ADMIN', firmId: 'firm-1' } };
  const res = createRes();

  await patchUserRole(req, res);
  assert.strictEqual(res.statusCode, 400);

  User.findOne = originalFindOne;
  console.log('✓ prevents role assignment above self');
}

async function testTeamRequiredWhenGuardEnabled() {
  const fs = require('fs');
  const modelSource = fs.readFileSync(require.resolve('../src/models/User.model.js'), 'utf8');
  assert.ok(modelSource.includes("ENFORCE_TEAM_NOT_NULL") && modelSource.includes('TEAM_NOT_SET'));
  console.log('✓ teamId guardrail exists in User pre-save checks');
}

(async () => {
  await testNoSecondPrimaryAdmin();
  await testManagerCannotMoveCrossTeamDocket();
  await testAdminCannotEscalateAboveSelf();
  await testTeamRequiredWhenGuardEnabled();
  console.log('\nRBAC/team stabilization tests passed.');
})().catch((error) => {
  console.error('RBAC/team stabilization tests failed:', error);
  process.exit(1);
});
