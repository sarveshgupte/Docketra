#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const read = (p) => fs.readFileSync(require('path').join(__dirname, '..', p), 'utf8');

const loader = read('ui/src/pages/admin/hooks/useAdminDataLoader.js');
assert.ok(loader.includes('Promise.allSettled(['), 'users/workbaskets must load independently');
assert.ok(loader.includes('setUsers(ensureLoggedInAdminVisible([]));'), 'users catch path must keep logged-in admin visible');
assert.ok(loader.includes('Workbaskets could not be loaded. User workbasket assignment controls may be unavailable.'), 'workbasket warning copy must exist');
assert.ok(loader.includes('Team members could not be loaded. Retry.'), 'user warning copy must exist');

const adminPage = read('ui/src/pages/AdminPage.jsx');
assert.ok(adminPage.includes('sectionMessage={[userSectionMessage, userLoadWarning, workbasketLoadWarning].filter(Boolean).join'), 'user section message should include warning messages');
assert.ok(adminPage.includes('setSelectedWorkbasketDraft') && adminPage.includes('useState([])'), 'selectedWorkbasketDraft must remain array-based');

const createModal = read('ui/src/pages/admin/components/CreateUserModal.jsx');
assert.ok(createModal.includes('Boolean(workbasketLoadWarning)'), 'create user modal should disable workbasket controls when unavailable');

const accessModal = read('ui/src/pages/admin/components/UserAccessModal.jsx');
assert.ok(accessModal.includes('Boolean(workbasketLoadWarning)'), 'user access modal should disable workbasket controls when unavailable');

const nav = read('ui/src/constants/platformNavigation.js');
for (const banned of ['Firm Memory', 'Knowledge', 'Company Brain', 'Relationships']) {
  assert.ok(!nav.includes(banned), `navigation must not include ${banned}`);
}
assert.ok(!adminPage.includes('Workbench'), 'AdminPage should not use Workbench copy');
assert.ok(adminPage.includes('<PlatformShell'), 'AdminPage must render inside PlatformShell');

console.log('adminTeamAccessResilience.test.js passed');
