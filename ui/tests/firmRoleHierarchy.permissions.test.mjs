import assert from 'node:assert/strict';
import { canManageClients, isAdmin } from '../src/utils/permissions.js';

assert.equal(isAdmin({ role: 'PRIMARY_ADMIN' }), true);
assert.equal(isAdmin({ role: 'ADMIN' }), true);
assert.equal(isAdmin({ role: 'MANAGER' }), false);

assert.equal(canManageClients({ role: 'PRIMARY_ADMIN', permissions: [] }), true);
assert.equal(canManageClients({ role: 'ADMIN', permissions: [] }), true);
assert.equal(canManageClients({ role: 'MANAGER', permissions: [] }), true);
assert.equal(canManageClients({ role: 'USER', permissions: [] }), false);
assert.equal(canManageClients({ role: 'USER', permissions: ['CLIENT_MANAGE'] }), true);
assert.equal(canManageClients({ role: 'USER', permissions: ['CLIENT_CREATE'] }), true);

console.log('frontend firm role hierarchy permission tests passed');
