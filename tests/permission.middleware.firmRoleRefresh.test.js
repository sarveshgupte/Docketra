#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

const runCase = async ({ req, requiredPermission = 'WORK_SETTINGS', resolveRequestFirmRole, resolveFirmRole, isSuperAdminRole = () => false }) => {
  Module._load = function(request) {
    if (request === '../services/authorization.service') return { resolveRequestFirmRole, resolveFirmRole };
    if (request === '../utils/role.utils') return { isSuperAdminRole };
    if (request === './authorization.middleware') return { requireAdmin: (_req, _res, next) => next() };
    if (request === '../models/User.model') return {};
    if (request === '../utils/log') return { error: () => {} };
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve('../src/middleware/permission.middleware')];
  const { authorizeFirmPermission } = require('../src/middleware/permission.middleware');
  let statusCode = 200; let payload = null; let nextCalled = false;
  const res = { status: (s) => { statusCode = s; return { json: (b) => { payload = b; } }; } };
  await authorizeFirmPermission(requiredPermission)(req, res, () => { nextCalled = true; });
  Module._load = originalLoad;
  return { statusCode, payload, nextCalled, req };
};

(async () => {
  const primary = await runCase({
    req: { firm: { id: 'F1' }, user: { _id: 'U1', role: 'USER' } },
    resolveRequestFirmRole: async () => ({ role: 'USER', permissions: ['CASE_VIEW'] }),
    resolveFirmRole: async () => ({ role: 'PRIMARY_ADMIN', permissions: ['WORK_SETTINGS'] }),
  });
  assert.strictEqual(primary.nextCalled, true, 'PRIMARY_ADMIN from DB should pass');

  const noEscalation = await runCase({
    req: { firm: { id: 'F1' }, user: { _id: 'U2', role: 'PRIMARY_ADMIN' } },
    resolveRequestFirmRole: async () => ({ role: 'PRIMARY_ADMIN', permissions: ['WORK_SETTINGS'] }),
    resolveFirmRole: async () => ({ role: 'USER', permissions: ['CASE_VIEW'] }),
  });
  assert.strictEqual(noEscalation.statusCode, 403, 'stale elevated request role must not grant access');

  const superadminBlocked = await runCase({
    req: { firm: { id: 'F1' }, user: { _id: 'SU1', role: 'SUPER_ADMIN' } },
    resolveRequestFirmRole: async () => ({ role: 'SUPER_ADMIN', permissions: ['WORK_SETTINGS'] }),
    resolveFirmRole: async () => ({ role: 'SUPER_ADMIN', permissions: ['WORK_SETTINGS'] }),
    isSuperAdminRole: () => true,
  });
  assert.strictEqual(superadminBlocked.statusCode, 403, 'superadmin should remain blocked');

  const missingFirm = await runCase({
    req: { user: { _id: 'U3', role: 'PRIMARY_ADMIN' } },
    resolveRequestFirmRole: async () => ({ role: 'PRIMARY_ADMIN', permissions: ['WORK_SETTINGS'] }),
    resolveFirmRole: async () => ({ role: 'PRIMARY_ADMIN', permissions: ['WORK_SETTINGS'] }),
  });
  assert.strictEqual(missingFirm.statusCode, 400, 'missing firm context must fail');

  console.log('permission.middleware role refresh and guardrails test passed');
})().catch((e) => {
  Module._load = originalLoad;
  console.error(e);
  process.exit(1);
});
