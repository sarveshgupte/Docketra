#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

const run = async ({ req, dbMembership }) => {
  Module._load = function(request) {
    if (request === '../models/User.model') return { findOne: async () => dbMembership };
    if (request === '../utils/role.utils') return { isSuperAdminRole: () => false, normalizeRole: (r) => String(r || '').toUpperCase() };
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve('../src/services/authorization.service')];
  const svc = require('../src/services/authorization.service');
  const result = await svc.resolveRequestFirmRole(req, 'F1');
  Module._load = originalLoad;
  return result;
};

(async () => {
  const cachedExplicit = await run({ req: { user: { role: 'USER', firmId: 'F1', permissions: ['CLIENT_CREATE'] } }, dbMembership: null });
  assert(cachedExplicit.permissions.includes('CLIENT_CREATE'), 'cached explicit CLIENT_CREATE should be preserved');

  const refreshedExplicit = await run({ req: { user: { _id: 'U1', role: 'USER' } }, dbMembership: { role: 'USER', permissions: ['CLIENT_MANAGE'] } });
  assert(refreshedExplicit.permissions.includes('CLIENT_MANAGE'), 'db explicit CLIENT_MANAGE should be merged');

  console.log('authorization.service.explicitClientPermissions.test.js passed');
})().catch((error) => {
  Module._load = originalLoad;
  throw error;
});
