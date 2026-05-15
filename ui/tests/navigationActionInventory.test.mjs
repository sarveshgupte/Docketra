import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const platformNav = read('src/constants/platformNavigation.js');
const platformShell = read('src/components/platform/PlatformShell.jsx');
const publicRoutes = read('src/routes/PublicRoutes.jsx');
const superadminInsights = read('src/pages/SuperadminOnboardingInsightsPage.jsx');
const superadminFirmDetail = read('src/pages/SuperadminFirmOnboardingDetailPage.jsx');
const notificationView = read('views/NotificationHistoryView.jsx');

assert.equal(publicRoutes.includes('path="/auth/otp"'), false, 'Stale /auth/otp route should not be publicly exposed.');
assert.equal(superadminInsights.includes('/f/${firm.firmSlug}/login'), false, 'Superadmin insights must not generate /f/:firmSlug/login links.');
assert.equal(superadminFirmDetail.includes('/f/${firm.firmSlug}/login'), false, 'Superadmin firm detail must not generate /f/:firmSlug/login links.');
assert.ok(superadminInsights.includes('/${firm.firmSlug}/login') && superadminFirmDetail.includes('/${firm.firmSlug}/login'), 'Superadmin firm login URLs should target /:firmSlug/login.');

assert.equal(notificationView.includes('<Layout>'), false, 'Notification history route must not wrap deprecated Layout inside firm shell route.');
assert.ok(notificationView.includes('<span className="sr-only">'), 'Notification view must contain sr-only context for accessibility');

for (const routeFactory of ['ROUTES.TASK_MANAGER', 'ROUTES.DASHBOARD', 'ROUTES.CLIENTS', 'ROUTES.ADMIN_REPORTS', 'ROUTES.ADMIN', 'ROUTES.SETTINGS']) {
  assert.ok(platformNav.includes(routeFactory), `Platform nav item missing valid route factory: ${routeFactory}`);
}

for (const commandId of ['go-docket-workbench', 'go-dashboard', 'go-clients', 'go-reports', 'go-team', 'go-settings']) {
  assert.ok(platformNav.includes(`id: '${commandId}'`), `Navigation command missing metadata id: ${commandId}`);
}

assert.ok(platformNav.includes("label: 'Work'"), 'Task Manager navigation label should be Work.');
assert.ok(platformNav.includes("section: 'Client Workspace'"), 'MVP client section should be present.');

assert.ok(platformShell.includes('hasQcQueueAccess'), 'Command center should include QC access control gate.');
assert.ok(platformShell.includes('hasAdminAccess ? [{ id: \'go-workbasket\''), 'Workbench command should be role-gated.');
assert.ok(platformShell.includes('hasQcQueueAccess ? [{ id: \'go-qc\''), 'QC command should be role-gated.');

console.log('navigationActionInventory.test.mjs passed');

assert.equal(platformNav.includes("id: 'company-brain'"), false, 'Company Brain should be hidden in MVP nav.');
