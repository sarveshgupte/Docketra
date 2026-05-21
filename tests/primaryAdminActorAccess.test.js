#!/usr/bin/env node
const assert = require('assert');
const { isPrimaryAdminActor } = require('../src/utils/role.utils');
const { buildRoleContext } = require('../src/services/authorization.service');

assert.strictEqual(isPrimaryAdminActor({ role: 'PRIMARY_ADMIN' }), true);
assert.strictEqual(isPrimaryAdminActor({ role: 'Primary Admin' }), true);
assert.strictEqual(isPrimaryAdminActor({ role: 'primary-admin' }), true);
assert.strictEqual(isPrimaryAdminActor({ role: 'ADMIN', isPrimaryAdmin: true }), true);
assert.strictEqual(isPrimaryAdminActor({ role: 'ADMIN', isSystem: true }), false);
assert.strictEqual(isPrimaryAdminActor({ role: 'ADMIN', defaultClientId: 'F1', firmId: 'F1' }), false);
assert.strictEqual(isPrimaryAdminActor({ role: 'ADMIN' }), false);
assert.strictEqual(isPrimaryAdminActor({ role: 'USER' }), false);
assert.strictEqual(isPrimaryAdminActor({ role: 'MANAGER' }), false);

assert.strictEqual(buildRoleContext({ role: 'Admin', isPrimaryAdmin: true }).canonicalRole, 'PRIMARY_ADMIN');
assert.strictEqual(buildRoleContext({ role: 'MANAGER' }).canonicalRole, 'MANAGER');

console.log('primaryAdminActorAccess.test.js passed');
