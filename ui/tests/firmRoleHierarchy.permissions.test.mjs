import assert from 'node:assert/strict';
import { isFirmAdminUser, canManageClientsByRoleOrPermission } from '../src/utils/firmAccess.js';

assert.equal(isFirmAdminUser({ role: 'PRIMARY_ADMIN' }), true);
assert.equal(isFirmAdminUser({ role: 'ADMIN' }), true);
assert.equal(isFirmAdminUser({ role: 'MANAGER' }), false);

assert.equal(canManageClientsByRoleOrPermission({ role: 'PRIMARY_ADMIN', permissions: [] }), true);
assert.equal(canManageClientsByRoleOrPermission({ role: 'ADMIN', permissions: [] }), true);
assert.equal(canManageClientsByRoleOrPermission({ role: 'MANAGER', permissions: [] }), true);
assert.equal(canManageClientsByRoleOrPermission({ role: 'USER', permissions: [] }), false);
assert.equal(canManageClientsByRoleOrPermission({ role: 'USER', permissions: ['CLIENT_MANAGE'] }), true);
assert.equal(canManageClientsByRoleOrPermission({ role: 'USER', permissions: ['CLIENT_CREATE'] }), true);

console.log('frontend firm role hierarchy permission tests passed');
