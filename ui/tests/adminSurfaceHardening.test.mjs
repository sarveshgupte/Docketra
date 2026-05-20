import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const adminPageSource = read('src/pages/AdminPage.jsx');

const whatsNewSource = read('../docs/whats-new.md');
const whatsNewTopSlice = whatsNewSource.split('\n').slice(0, 20).join('\n');
assert.ok(whatsNewTopSlice.includes('## 2026-05-20 — Cleaned up Admin and Work Settings layout'), "What's New should list admin/work settings cleanup in the latest top section");

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
assert.ok(adminPageSource.includes("role: ['EMPLOYEE', 'USER', 'STAFF'].includes(normalizedRole) ? 'USER' : normalizedRole"), 'Create user submit should normalize employee role aliases to USER API contract');

assert.ok(adminPageSource.includes('actions={(<Button variant="outline" onClick={() => void handleRefreshAdminSurface()}>Refresh</Button>)}'), 'AdminPage should pass Refresh action through PlatformShell actions');
assert.ok(!adminPageSource.includes('<PageHeader'), 'AdminPage should not render a duplicate PageHeader under PlatformShell');

const categoryModalsSource = read('src/pages/admin/components/AdminCategoryModals.jsx');
assert.ok(categoryModalsSource.includes('requiresRelatedEmployeeUser'), 'Category and subcategory modal flows should keep related employee/user setting wired');
assert.ok(categoryModalsSource.includes('admin__checkbox-field'), 'Category modal checkbox layout should use shared CSS classes instead of utility-only layout');

const categoriesSectionSource = read('src/pages/admin/components/AdminCategoriesSection.jsx');
assert.ok(categoriesSectionSource.includes('admin__action-group--danger'), 'Category actions should visually separate destructive actions');
assert.ok(categoriesSectionSource.includes('onDeleteCategory(category)'), 'Category delete action should remain wired');
assert.ok(categoriesSectionSource.includes('onDeleteSubcategory(category, sub)'), 'Subcategory delete action should remain wired');
assert.ok(categoriesSectionSource.includes('aria-label={`${sub.name} destructive actions`}'), 'Subcategory destructive action should render in a dedicated danger action group');


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
