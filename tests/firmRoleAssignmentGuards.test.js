#!/usr/bin/env node
const assert = require('assert');

const schema = require('../src/schemas/user.routes.schema');
const { canInviteRole } = require('../src/utils/hierarchy.utils');
const { hasFirmRoleAtLeast } = require('../src/utils/role.utils');

assert.doesNotThrow(() => schema['PATCH /:id/role'].body.parse({ role: 'MANAGER' }), 'role update should accept MANAGER');
assert.throws(() => schema['PATCH /:id/role'].body.parse({ role: 'PRIMARY_ADMIN' }), 'role update should reject PRIMARY_ADMIN assignment');
assert.doesNotThrow(() => schema['POST /'].body.parse({ email: 'user@example.com', role: 'MANAGER' }), 'user create should accept MANAGER');
assert.throws(() => schema['POST /'].body.parse({ email: 'user@example.com', role: 'PRIMARY_ADMIN' }), 'user create should reject PRIMARY_ADMIN assignment');

assert.strictEqual(canInviteRole('PRIMARY_ADMIN', 'PRIMARY_ADMIN'), false, 'team management invite flow must not allow assigning PRIMARY_ADMIN');
assert.strictEqual(canInviteRole('PRIMARY_ADMIN', 'MANAGER'), true, 'team management invite flow must allow MANAGER');

assert.strictEqual(hasFirmRoleAtLeast({ role: 'ADMIN' }, 'MANAGER'), true, 'ADMIN should inherit manager access');
assert.strictEqual(hasFirmRoleAtLeast({ role: 'PRIMARY_ADMIN' }, 'ADMIN'), true, 'PRIMARY_ADMIN should inherit admin access');
assert.strictEqual(hasFirmRoleAtLeast({ role: 'PRIMARY_ADMIN' }, 'MANAGER'), true, 'PRIMARY_ADMIN should inherit manager access');

console.log('firmRoleAssignmentGuards.test.js passed');
