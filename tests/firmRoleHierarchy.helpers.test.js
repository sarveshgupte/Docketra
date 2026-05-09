const assert = require('assert');
const {
  normalizeFirmRole,
  getFirmRoleRank,
  hasFirmRoleAtLeast,
  isFirmAdminOrAbove,
  isFirmManagerOrAbove,
} = require('../src/utils/role.utils');

assert.strictEqual(normalizeFirmRole('Primary Admin'), 'PRIMARY_ADMIN');
assert.strictEqual(normalizeFirmRole('employee'), 'USER');
assert.strictEqual(getFirmRoleRank('PRIMARY_ADMIN'), 4);
assert.strictEqual(getFirmRoleRank('ADMIN'), 3);
assert.strictEqual(getFirmRoleRank('MANAGER'), 2);
assert.strictEqual(getFirmRoleRank('USER'), 1);
assert.strictEqual(hasFirmRoleAtLeast({ role: 'PRIMARY_ADMIN' }, 'ADMIN'), true);
assert.strictEqual(hasFirmRoleAtLeast({ role: 'ADMIN' }, 'MANAGER'), true);
assert.strictEqual(hasFirmRoleAtLeast({ role: 'MANAGER' }, 'ADMIN'), false);
assert.strictEqual(hasFirmRoleAtLeast({ role: 'USER' }, 'MANAGER'), false);
assert.strictEqual(isFirmAdminOrAbove({ role: 'PRIMARY_ADMIN' }), true);
assert.strictEqual(isFirmAdminOrAbove({ role: 'ADMIN' }), true);
assert.strictEqual(isFirmAdminOrAbove({ role: 'MANAGER' }), false);
assert.strictEqual(isFirmManagerOrAbove({ role: 'PRIMARY_ADMIN' }), true);
assert.strictEqual(isFirmManagerOrAbove({ role: 'ADMIN' }), true);
assert.strictEqual(isFirmManagerOrAbove({ role: 'MANAGER' }), true);
assert.strictEqual(isFirmManagerOrAbove({ role: 'USER' }), false);

console.log('firm role hierarchy helper tests passed');
