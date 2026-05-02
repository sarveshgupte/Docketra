const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schemas = require('../src/schemas/superadmin.routes.schema');
const readinessHelpers = require('../src/services/superadminPilotReadiness.helpers');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/pilot-readiness', requireSuperadmin, authorize(SuperAdminPolicy.canViewPlatformStats), getPilotReadiness);"), 'pilot-readiness route should exist with superadmin + policy');
assert.ok(schemas['GET /pilot-readiness'], 'schema should include GET /pilot-readiness');

const { clampScore, deriveOverallStatus, CHECKLIST_KEYS } = readinessHelpers;
assert.strictEqual(clampScore(120), 100); assert.strictEqual(clampScore(-4), 0);
assert.strictEqual(deriveOverallStatus({ score: 90, failCount: 0 }), 'ready');
assert.strictEqual(deriveOverallStatus({ score: 70, failCount: 0 }), 'watch');
assert.strictEqual(deriveOverallStatus({ score: 60, failCount: 0 }), 'blocked');
assert.strictEqual(deriveOverallStatus({ score: 95, failCount: 1 }), 'blocked');
assert.deepStrictEqual(CHECKLIST_KEYS, [
  'superadmin_auth_route_protection','firm_creation_admin_invite_readiness','firm_health_risk_queue_readiness','plans_capacity_readiness','onboarding_readiness','storage_byos_readiness','support_diagnostics_readiness','audit_logging_readiness','primary_admin_sidebar_route_readiness','no_public_billing_payment_flows',
], 'checklist should include all required keys');

const serviceSource = fs.readFileSync(path.resolve(__dirname, '../src/services/superadminPilotReadiness.service.js'), 'utf8');
assert.ok(serviceSource.includes('tests/primaryAdminSidebarRouteBoundaries.test.js'), 'primary-admin readiness should cite route-boundary test contract');
for (const fixedPath of ['/api/clients', '/api/reports/case-metrics', '/api/storage/configuration', '/api/ai/configuration']) {
  assert.ok(serviceSource.includes(fixedPath), `primary-admin readiness evidence should include ${fixedPath}`);
}
assert.ok(!serviceSource.includes('firmsNeedingOnboardingFollowUp'), 'plans/capacity readiness must not use onboarding follow-up signal');

const lazy = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazy.includes('SuperadminPilotReadinessPage'), 'lazy export should exist');
const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/pilot-readiness"'), 'protected route should exist');
const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Pilot Readiness'), 'nav link should exist');
assert.ok(!layout.includes('href="#"'), 'no placeholder href links');
const page = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminPilotReadinessPage.jsx'), 'utf8');
assert.ok(page.includes('platform metadata only'), 'privacy text should exist');
assert.ok(!page.includes('href="#"'), 'page must not include placeholder href links');

console.log('superadminPilotReadiness.routes.ui.schema.test.js passed');
