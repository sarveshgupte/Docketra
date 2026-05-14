#!/usr/bin/env node
const assert = require('assert');

const schema = require('../src/schemas/user.routes.schema');
const { canInviteRole } = require('../src/utils/hierarchy.utils');
const { hasFirmRoleAtLeast } = require('../src/utils/role.utils');
const { validateRow: validateBackendBulkRow } = require('../src/constants/bulkUploadSchema');
const { BULK_UPLOAD_SCHEMA: frontendBulkSchema } = require('../ui/src/constants/bulkUploadSchema');

assert.doesNotThrow(() => schema['PATCH /:id/role'].body.parse({ role: 'MANAGER' }), 'role update should accept MANAGER');
assert.throws(() => schema['PATCH /:id/role'].body.parse({ role: 'PRIMARY_ADMIN' }), 'role update should reject PRIMARY_ADMIN assignment');
assert.doesNotThrow(() => schema['POST /'].body.parse({ email: 'user@example.com', role: 'MANAGER' }), 'user create should accept MANAGER');
assert.throws(() => schema['POST /'].body.parse({ email: 'user@example.com', role: 'PRIMARY_ADMIN' }), 'user create should reject PRIMARY_ADMIN assignment');

assert.strictEqual(canInviteRole('PRIMARY_ADMIN', 'PRIMARY_ADMIN'), false, 'team management invite flow must not allow assigning PRIMARY_ADMIN');
assert.strictEqual(canInviteRole('PRIMARY_ADMIN', 'MANAGER'), true, 'team management invite flow must allow MANAGER');

assert.deepStrictEqual(validateBackendBulkRow({ name: 'A', email: 'a@a.com', role: 'manager', workbaskets: 'WB-1' }, 'team'), [], 'bulk team upload should accept manager');
assert.notDeepStrictEqual(validateBackendBulkRow({ name: 'A', email: 'a@a.com', role: 'primary_admin', workbaskets: 'WB-1' }, 'team'), [], 'bulk team upload should reject primary admin');

const backendClientRequired = require('../src/constants/bulkUploadSchema').BULK_UPLOAD_SCHEMA.clients.fields.filter((f) => f.required).map((f) => f.key).sort();
const frontendClientRequired = frontendBulkSchema.clients.fields.filter((f) => f.required).map((f) => f.key).sort();
assert.deepStrictEqual(backendClientRequired, frontendClientRequired, 'backend and frontend client bulk required fields should stay aligned');

assert.strictEqual(hasFirmRoleAtLeast({ role: 'ADMIN' }, 'MANAGER'), true, 'ADMIN should inherit manager access');
assert.strictEqual(hasFirmRoleAtLeast({ role: 'PRIMARY_ADMIN' }, 'ADMIN'), true, 'PRIMARY_ADMIN should inherit admin access');
assert.strictEqual(hasFirmRoleAtLeast({ role: 'PRIMARY_ADMIN' }, 'MANAGER'), true, 'PRIMARY_ADMIN should inherit manager access');

console.log('firmRoleAssignmentGuards.test.js passed');
