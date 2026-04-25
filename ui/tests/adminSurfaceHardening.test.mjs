import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const adminPageSource = read('src/pages/AdminPage.jsx');
assert.ok(adminPageSource.includes('AdminUsersSection'), 'AdminPage should delegate user rendering to AdminUsersSection');
assert.ok(adminPageSource.includes('AdminClientsSection'), 'AdminPage should delegate client rendering to AdminClientsSection');
assert.ok(adminPageSource.includes('AdminCategoriesSection'), 'AdminPage should delegate category rendering to AdminCategoriesSection');
assert.ok(adminPageSource.includes('CreateUserModal'), 'AdminPage should delegate create-user form to CreateUserModal');
assert.ok(adminPageSource.includes('UserAccessModal'), 'AdminPage should delegate access assignment to UserAccessModal');
assert.ok(adminPageSource.includes('useAdminDataLoader'), 'AdminPage should use shared admin data loader hook');
assert.ok(adminPageSource.includes('actionLoadingByUser'), 'AdminPage should track per-user action loading state');
assert.ok(adminPageSource.includes('ActionConfirmModal'), 'AdminPage should use ActionConfirmModal for high-risk actions');
assert.ok(!adminPageSource.includes('window.confirm('), 'AdminPage should not use native window.confirm for user admin actions');
assert.ok(adminPageSource.includes('pendingConfirmation'), 'AdminPage should keep centralized confirmation state');
assert.ok(adminPageSource.includes('if (creatingUser) return;'), 'Create user should protect against duplicate submits');

const usersSectionSource = read('src/pages/admin/components/AdminUsersSection.jsx');
assert.ok(usersSectionSource.includes('Team Members'), 'Users section should use clearer heading copy');
assert.ok(usersSectionSource.includes('Reset Password'), 'Users section should expose reset-password action');
assert.ok(usersSectionSource.includes('Unlock'), 'Users section should expose unlock action');
assert.ok(usersSectionSource.includes('disabled={isPrimaryAdminUser(u) || isActionLoading}'), 'Critical status action should disable for primary admin and loading state');

const createUserModalSource = read('src/pages/admin/components/CreateUserModal.jsx');
assert.ok(createUserModalSource.includes('Role hierarchy'), 'Create user modal should explain role hierarchy');
assert.ok(createUserModalSource.includes('superAdminNote'), 'Create user modal should keep platform-only role boundary explicit');
assert.ok(createUserModalSource.includes("{ value: 'Employee', label: 'Employee' }"), 'Create user modal should include Employee role label');
assert.ok(createUserModalSource.includes("{ value: 'Admin', label: 'Admin' }"), 'Create user modal should include Admin role label');

const roleCopySource = read('src/pages/admin/adminRoleCopy.js');
assert.ok(roleCopySource.includes('Primary Admin > Admin > Manager > Employee'), 'Role copy should define canonical role hierarchy');

console.log('adminSurfaceHardening.test.mjs passed');
