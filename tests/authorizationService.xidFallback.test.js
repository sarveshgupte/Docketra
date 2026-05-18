#!/usr/bin/env node
const assert = require('assert');

const userModelPath = require.resolve('../src/models/User.model');
const authzPath = require.resolve('../src/services/authorization.service');

const originalUserModel = require.cache[userModelPath];
delete require.cache[userModelPath];
require.cache[userModelPath] = {
  id: userModelPath,
  filename: userModelPath,
  loaded: true,
  exports: {
    findOne: async (query) => {
      if (query.firmId !== 'F1' || query.xID !== 'X000001') return null;
      return { role: 'Primary Admin', permissions: ['admin_stats'] };
    },
  },
};

delete require.cache[authzPath];
const { resolveRequestFirmRole } = require('../src/services/authorization.service');

(async () => {
  const req = { user: { xID: 'X000001', role: 'primary admin', firmId: 'MISMATCHED_FIRM' } };
  const membership = await resolveRequestFirmRole(req, 'F1');
  assert(membership, 'membership should resolve by xID fallback when user id is unavailable');
  assert.strictEqual(membership.canonicalRole, 'PRIMARY_ADMIN');
  assert(membership.permissions.includes('USER_VIEW'));
  assert(membership.permissions.includes('ADMIN_STATS'));
  console.log('authorizationService.xidFallback.test.js passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  delete require.cache[authzPath];
  delete require.cache[userModelPath];
  if (originalUserModel) require.cache[userModelPath] = originalUserModel;
});
