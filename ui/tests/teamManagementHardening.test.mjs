import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const adminPage = read('ui/src/pages/AdminPage.jsx');
assert.ok(adminPage.includes('Admin access is required to manage team members.'), 'Team-management denial copy should be standardized.');

const usersSection = read('ui/src/pages/admin/components/AdminUsersSection.jsx');
assert.ok(usersSection.includes('No team members added yet'), 'Users empty state should use team members copy.');

const createModal = read('ui/src/pages/admin/components/CreateUserModal.jsx');
for (const role of ['Admin', 'Manager', 'Employee']) {
  assert.ok(createModal.includes(`label: '${role}'`), `Role dropdown should include ${role}.`);
}
assert.ok(!createModal.includes("label: 'Primary Admin'"), 'Primary Admin must not be assignable in dropdown.');
assert.ok(!createModal.includes("label: 'SuperAdmin'"), 'SuperAdmin must not be assignable in dropdown.');

const routeSchemas = read('src/schemas/admin.routes.schema.js');
assert.ok(routeSchemas.includes("'POST /users': { body: z.object({ name: nonEmptyString, email: z.string().trim().email(), role: z.enum(['ADMIN','MANAGER','USER'])"), 'Create user schema should restrict assignable roles.');
assert.ok(routeSchemas.includes("'PATCH /users/:xID/workbaskets':"), 'Workbasket mutation schema should exist.');
assert.ok(routeSchemas.includes('.strict()'), 'Team mutation schemas should use strict payload handling.');

console.log('teamManagementHardening.test.mjs passed');
