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

for (const routeFactory of ['ROUTES.TASK_MANAGER', 'ROUTES.DASHBOARD', 'ROUTES.CMS', 'ROUTES.CRM', 'ROUTES.CLIENTS', 'ROUTES.ADMIN_REPORTS', 'ROUTES.ADMIN', 'ROUTES.SETTINGS']) {
  assert.ok(platformNav.includes(routeFactory), `Platform nav item missing valid route factory: ${routeFactory}`);
}

for (const commandId of ['go-docket-workbench', 'go-dashboard', 'go-cms', 'go-crm', 'go-clients', 'go-reports', 'go-team', 'go-settings']) {
  assert.ok(platformNav.includes(`id: '${commandId}'`), `Navigation command missing metadata id: ${commandId}`);
}

assert.ok(platformNav.includes("id: 'intake'") && platformNav.includes("id: 'crm'"), 'Knowledge Intake and Relationships items should remain present in nav blueprint.');
assert.ok(platformNav.includes("id: 'intake'") && platformNav.includes("minRole: 'ADMIN'"), 'Knowledge Intake should remain admin-only.');
assert.ok(platformNav.includes("id: 'crm'") && platformNav.includes("minRole: 'ADMIN'"), 'Relationships should remain admin-only.');
assert.ok(platformNav.includes("label: 'Work'"), 'Task Manager navigation label should be Work.');
assert.ok(platformNav.includes("section: 'Firm Memory'"), 'Business modules section should use Firm Memory label.');
assert.ok(platformNav.includes("label: 'Knowledge Intake'"), 'CMS navigation label should be Knowledge Intake.');
assert.ok(platformNav.includes("label: 'Relationships'"), 'CRM navigation label should be Relationships.');

assert.ok(platformShell.includes('hasQcQueueAccess'), 'Command center should include QC access control gate.');
assert.ok(platformShell.includes('hasAdminAccess ? [{ id: \'go-workbasket\''), 'Workbench command should be role-gated.');
assert.ok(platformShell.includes('hasQcQueueAccess ? [{ id: \'go-qc\''), 'QC command should be role-gated.');

console.log('navigationActionInventory.test.mjs passed');
