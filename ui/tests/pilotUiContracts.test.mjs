import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(cwd, relativePath), 'utf8');

const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');
for (const routeFragment of [
  'path="dashboard"',
  'path="worklist"',
  'path="clients"',
  'path="dockets/create"',
  'path="global-worklist"',
  'path="my-worklist"',
  'path="admin"',
  'path="settings"',
  'path="settings/work"',
  'path="admin/reports"',
  'path="dockets/:caseId"',
]) {
  assert.ok(protectedRoutes.includes(routeFragment), `Protected routes must include ${routeFragment}.`);
}

const platformNavigation = read('src/constants/platformNavigation.js');
for (const allowed of ["label: 'Work'", "label: 'Dashboard'", "label: 'Clients'", "label: 'Reports'", "label: 'Settings'"]) {
  assert.ok(platformNavigation.includes(allowed), `Navigation must include ${allowed}.`);
}
for (const blocked of ['Firm Memory', 'Knowledge Intake', 'Relationships', 'Company Brain', 'Knowledge Library']) {
  assert.equal(platformNavigation.includes(blocked), false, `Navigation must not include blocked label: ${blocked}.`);
}

const adminDataLoader = read('src/pages/admin/hooks/useAdminDataLoader.js');
assert.ok(adminDataLoader.includes('Promise.allSettled'), 'Admin data loader should use Promise.allSettled for partial-failure tolerance.');

const teamPage = read('src/pages/AdminPage.jsx');
assert.ok(teamPage.includes('PlatformShell'), 'AdminPage should remain wired through PlatformShell.');

const clientsPage = read('src/pages/ClientsPage.jsx');
assert.ok(clientsPage.includes('Client encryption setup needs repair before clients can be loaded.'), 'Clients page should expose actionable tenant-key fallback copy.');

const createDocket = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(createDocket.includes('defaults to your firm for internal work'), 'Create Docket should support default firm client fallback guidance.');
assert.ok(createDocket.includes('checklist') || createDocket.includes('Checklist'), 'Create Docket should provide checklist guidance when dependencies are missing.');

const workbasketPage = read('src/pages/WorkbasketPage.jsx');
assert.ok(workbasketPage.includes('Pull to My Worklist'), 'Workbasket page must expose Pull to My Worklist action/copy.');

console.log('pilotUiContracts.test.mjs passed');

assert.equal(platformNavigation.includes("label: 'Team & Access'"), false, 'Navigation must not include a dedicated Team & Access sidebar item.');
