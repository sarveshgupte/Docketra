import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

const adminRoutes = read('src/routes/admin.routes.js');
assert.ok(adminRoutes.includes("router.put('/users/:xID/activate', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE')"), 'Activate route should be gated by USER_MANAGE permission.');
assert.ok(adminRoutes.includes("router.put('/users/:xID/deactivate', ...adminBaseAccess, authorizeFirmPermission('USER_MANAGE')"), 'Deactivate route should be gated by USER_MANAGE permission.');
assert.ok(adminRoutes.includes("router.patch('/users/:xID/workbaskets', ...adminBaseAccess, authorizeFirmPermission('WORKBASKET_MANAGE')"), 'Workbasket assignment route should be gated by WORKBASKET_MANAGE permission.');

const authController = read('src/controllers/auth.controller.js');
assert.ok(authController.includes('assertCanDeactivateUser(user);'), 'Deactivate flow should enforce protected-user guard.');
assert.ok(authController.includes('if (guardError instanceof PrimaryAdminActionError)'), 'Deactivate flow should treat primary-admin guard violations explicitly.');

const roleUtils = read('src/utils/role.utils.js');
assert.ok(roleUtils.includes("const isFirmAdminOrAbove = (user) => hasFirmRoleAtLeast(user, 'ADMIN');"), 'Firm admin hierarchy helper should require ADMIN or above.');

console.log('teamManagementRouteGuards.test.mjs passed');
