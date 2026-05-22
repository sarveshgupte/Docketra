import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), 'ui', rel), 'utf8');

const navSource = read('src/constants/platformNavigation.js');
const routesSource = read('src/routes/ProtectedRoutes.jsx');
const superadminLayoutSource = read('src/components/common/SuperAdminLayout.jsx');
const pilotSurfaceSource = read('src/constants/pilotSurface.js');

for (const hiddenId of ['crm', 'cms', 'company-brain', 'knowledge-library', 'ai-settings', 'storage-settings', 'reports']) {
  assert.ok(pilotSurfaceSource.includes(`'${hiddenId}'`), `Pilot surface should hide nav item: ${hiddenId}`);
}

for (const visibleText of ['My Worklist', 'Workbaskets', 'Clients']) {
  assert.ok(navSource.includes(visibleText), `Navigation should keep pilot-visible item/group: ${visibleText}`);
}

for (const blockedPath of ['crm', 'cms', 'company-brain', 'knowledge', 'ai-settings', 'storage-settings', 'admin/reports', 'settings']) {
  assert.ok(routesSource.includes(`PilotRouteGate subPath=\"${blockedPath}\"`), `Protected routes should gate non-MVP route: ${blockedPath}`);
}

assert.ok(routesSource.includes('path="settings/work"'), 'Work settings route should remain present for pilot assignment/workbasket setup.');
assert.ok(!routesSource.includes('PilotRouteGate subPath="settings/work"'), 'Work settings route should remain accessible and must not be gated in pilot.');

for (const hiddenNavPath of ['/app/superadmin/onboarding-insights', '/app/superadmin/firm-health', '/app/superadmin/feature-flags', '/app/superadmin/plans']) {
  assert.ok(superadminLayoutSource.includes(`showSuperadminNavItem('${hiddenNavPath}')`), `Superadmin layout should hide non-pilot nav item by config: ${hiddenNavPath}`);
}

console.log('pilotSurfaceNavigation.test.mjs passed');
