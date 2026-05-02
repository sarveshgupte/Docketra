const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schemas = require('../src/schemas/superadmin.routes.schema');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/plans', requireSuperadmin"), 'GET /plans should require requireSuperadmin');
assert.ok(routes.includes("router.patch('/firms/:firmId/plan-capacity', requireSuperadmin"), 'PATCH /firms/:firmId/plan-capacity should require requireSuperadmin');
assert.ok(routes.includes("superadminAdminManagementLimiter, updateFirmPlanCapacity"), 'PATCH /plan-capacity should include management limiter');

const planCapacitySchema = schemas['PATCH /firms/:firmId/plan-capacity'];
assert.ok(planCapacitySchema, 'schema should include PATCH plan-capacity');
assert.throws(() => planCapacitySchema.body.parse({ randomField: 'x' }), 'schema should reject unknown-only payload');
assert.doesNotThrow(() => planCapacitySchema.body.parse({ maxUsers: 25 }), 'schema should accept known editable field payload');
assert.doesNotThrow(() => planCapacitySchema.body.parse({ plan: 'pilot', billingStatus: 'trialing' }), 'schema should accept known editable field combinations');

const schemaSource = fs.readFileSync(path.resolve(__dirname, '../src/schemas/superadmin.routes.schema.js'), 'utf8');
assert.ok(schemaSource.includes('.min(1).max(500)'), 'maxUsers bounds should be enforced');

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
assert.ok(plansPage.includes('const [saving, setSaving] = useState(false)'), 'save should track saving state');
assert.ok(plansPage.includes('setSaveError('), 'save should handle and render save errors');
assert.ok(plansPage.includes('try {') && plansPage.includes('catch (e)'), 'save should have error handling');

console.log('✓ superadmin plans/capacity routes, schema, and UI wiring checks passed');
