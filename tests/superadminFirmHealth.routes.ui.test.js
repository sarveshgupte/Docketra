const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/firm-health', requireSuperadmin, authorize(SuperAdminPolicy.canViewPlatformStats), getFirmHealth);"), 'firm-health route must exist and be superadmin protected');

const lazy = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazy.includes('SuperadminFirmHealthPage'), 'lazy export should exist for firm health page');

const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/firm-health"'), 'protected firm health route should exist');

const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Firm Health'), 'nav should include Firm Health link');

const page = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminFirmHealthPage.jsx'), 'utf8');
for (const label of ['Firm Health & Risk Queue', 'Risk queue', 'Privacy boundary']) {
  assert.ok(page.includes(label), `firm health page should include ${label}`);
}
assert.ok(!page.includes('href="#"'), 'firm health page must not use href="#"');

const dashboard = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminDashboard.jsx'), 'utf8');
assert.ok(dashboard.includes('/app/superadmin/firm-health'), 'command center should link to firm health');

console.log('superadminFirmHealth.routes.ui.test.js passed');
