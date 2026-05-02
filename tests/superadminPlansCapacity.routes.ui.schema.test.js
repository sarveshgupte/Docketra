const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/plans', requireSuperadmin"), 'GET /plans should require requireSuperadmin');
assert.ok(routes.includes("router.patch('/firms/:firmId/plan-capacity', requireSuperadmin"), 'PATCH /firms/:firmId/plan-capacity should require requireSuperadmin');

const schema = fs.readFileSync(path.resolve(__dirname, '../src/schemas/superadmin.routes.schema.js'), 'utf8');
assert.ok(schema.includes("'GET /plans'"), 'schema should include GET /plans');
assert.ok(schema.includes("'PATCH /firms/:firmId/plan-capacity'"), 'schema should include PATCH plan-capacity');
assert.ok(schema.includes('.min(1).max(500)'), 'maxUsers bounds should be enforced');

const controller = fs.readFileSync(path.resolve(__dirname, '../src/controllers/superadmin.controller.js'), 'utf8');
assert.ok(controller.includes('maxUsers cannot be lower than current active user count'), 'should block maxUsers below active users');
assert.ok(controller.includes('FirmPlanCapacityUpdated'), 'should attempt audit log action for changes');
assert.ok(!controller.includes('stripe') && !controller.includes('checkout') && !controller.includes('invoice'), 'should not introduce public billing flows');

const lazy = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazy.includes('SuperadminPlansPage'), 'lazy export should exist');

const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/plans"'), 'protected route should exist');
assert.ok(protectedRoutes.includes('<SuperadminPlansPage />'), 'plans page should be routed');

const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Plans & Capacity'), 'nav link should exist');
assert.ok(!layout.includes('href="#"'), 'no placeholder anchors');

const dashboard = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminDashboard.jsx'), 'utf8');
assert.ok(dashboard.includes('/app/superadmin/plans'), 'dashboard should link to plans');

const plansPage = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminPlansPage.jsx'), 'utf8');
assert.ok(plansPage.includes('Plans & Capacity'), 'page title should exist');
assert.ok(plansPage.includes('platform billing-readiness metadata only'), 'privacy note should exist');

console.log('✓ superadmin plans/capacity routes, schema, and UI wiring checks passed');
