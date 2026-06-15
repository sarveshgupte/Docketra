import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');

const navSource = read('constants/platformNavigation.js');
const routesSource = read('routes/ProtectedRoutes.jsx');
const layoutSource = read('components/common/Layout.jsx');
const superadminLayoutSource = read('components/common/SuperAdminLayout.jsx');
const pilotSurfaceSource = read('constants/pilotSurface.js');

for (const visibleNavText of [
  "label: 'My Worklist'",
  "label: 'Workbaskets'",
  "label: 'Clients'",
  "label: 'Settings'",
]) {
  assert.ok(navSource.includes(visibleNavText), `Pilot navigation should keep visible item: ${visibleNavText}`);
}
assert.ok(navSource.includes("label: 'QC Worklists'"), 'Pilot navigation should keep QC queue grouping when configured.');
assert.ok(layoutSource.includes('ROUTES.PROFILE(currentFirmSlug)'), 'Profile destination should remain present.');
assert.ok(layoutSource.includes('NotificationHistoryView') || routesSource.includes('path="notifications"'), 'Notifications route should remain available when present.');

for (const hiddenNavId of ['crm', 'cms', 'company-brain', 'knowledge-library', 'ai-settings', 'storage-settings', 'data-storage-map', 'reports']) {
  assert.ok(pilotSurfaceSource.includes(`'${hiddenNavId}'`), `Pilot surface config should keep hidden nav id: ${hiddenNavId}`);
}

for (const hiddenRoute of [
  'crm',
  'cms',
  'company-brain',
  'knowledge',
  'ai-settings',
  'storage-settings',
  'data-storage-map',
  'admin/reports',
  'updates',
  'settings',
  'settings/firm',
]) {
  assert.ok(routesSource.includes(`PilotRouteGate subPath=\"${hiddenRoute}\"`), `Hidden route must be gated by PilotRouteGate: ${hiddenRoute}`);
}

for (const allowedRoute of [
  'path="worklist"',
  'path="global-worklist"',
  'path="qc-queue"',
  'path="dockets/create"',
  'path="dockets/:caseId"',
  'path="clients"',
  'path="clients/:clientId"',
  'path="settings/work"',
  'path="profile"',
  'path="notifications"',
]) {
  assert.ok(routesSource.includes(allowedRoute), `Allowed pilot route should exist: ${allowedRoute}`);
}
assert.ok(!routesSource.includes('PilotRouteGate subPath="settings/work"'), 'settings/work must stay outside PilotRouteGate.');
assert.ok(!routesSource.includes('PilotRouteGate subPath="dockets"'), 'Dockets routes must stay outside PilotRouteGate.');

for (const shortcutRef of [
  'ROUTES.CREATE_CASE(currentFirmSlug)',
  'ROUTES.WORKLIST(currentFirmSlug)',
  'ROUTES.GLOBAL_WORKLIST(currentFirmSlug)',
]) {
  assert.ok(layoutSource.includes(shortcutRef), `Core pilot quick actions/shortcuts must resolve: ${shortcutRef}`);
}
assert.ok(layoutSource.includes('ROUTES.QC_QUEUE(currentFirmSlug)'), 'QC queue shortcut/action should remain wired where applicable.');
for (const blockedDestination of [
  'ROUTES.CRM(',
  'ROUTES.CMS(',
  'ROUTES.COMPANY_BRAIN(',
  'ROUTES.KNOWLEDGE_LIBRARY(',
  'ROUTES.AI_SETTINGS(',
  'ROUTES.STORAGE_SETTINGS(',
  'ROUTES.DATA_STORAGE_MAP(',
]) {
  assert.equal(layoutSource.includes(blockedDestination), false, `Command/quick action destination should not point to hidden route: ${blockedDestination}`);
}

for (const superadminVisible of ['Platform Dashboard', 'Firms', 'Pilot Readiness', 'Support Diagnostics']) {
  assert.ok(superadminLayoutSource.includes(superadminVisible), `SuperAdmin pilot nav should include: ${superadminVisible}`);
}
for (const hiddenSuperadminNav of [
  '/app/superadmin/onboarding-insights',
  '/app/superadmin/firm-health',
  '/app/superadmin/feature-flags',
  '/app/superadmin/plans',
  '/app/superadmin/audit',
]) {
  assert.ok(superadminLayoutSource.includes(`showSuperadminNavItem('${hiddenSuperadminNav}')`), `SuperAdmin hidden surface should stay gate-controlled: ${hiddenSuperadminNav}`);
}

console.log('pilotLaunchReadinessInventory.test.mjs passed');
