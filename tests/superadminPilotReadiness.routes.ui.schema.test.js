const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schemas = require('../src/schemas/superadmin.routes.schema');
const readinessService = require('../src/services/superadminPilotReadiness.service');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/pilot-readiness', requireSuperadmin, authorize(SuperAdminPolicy.canViewPlatformStats), getPilotReadiness);"), 'pilot-readiness route should exist with superadmin + policy');
assert.ok(schemas['GET /pilot-readiness'], 'schema should include GET /pilot-readiness');

const { clampScore, deriveOverallStatus, CHECKLIST_KEYS } = readinessService._private;
assert.strictEqual(clampScore(120), 100); assert.strictEqual(clampScore(-4), 0);
assert.strictEqual(deriveOverallStatus({ score: 90, failCount: 0 }), 'ready');
assert.strictEqual(deriveOverallStatus({ score: 70, failCount: 0 }), 'watch');
assert.strictEqual(deriveOverallStatus({ score: 60, failCount: 0 }), 'blocked');
assert.strictEqual(deriveOverallStatus({ score: 95, failCount: 1 }), 'blocked');
assert.ok(CHECKLIST_KEYS.length >= 10, 'checklist should include required categories');

const sensitiveKeys = ['password', 'otp', 'token', 'cookie', 'authorization', 'paymentInstrument'];
const serviceSource = fs.readFileSync(path.resolve(__dirname, '../src/services/superadminPilotReadiness.service.js'), 'utf8').toLowerCase();
assert.ok(!sensitiveKeys.some((key) => serviceSource.includes(`data.${key}`)), 'response shaping should not include sensitive keys');

const lazy = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazy.includes('SuperadminPilotReadinessPage'), 'lazy export should exist');
const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/pilot-readiness"'), 'protected route should exist');
const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Pilot Readiness'), 'nav link should exist');
assert.ok(!layout.includes('href="#"'), 'no placeholder href links');
const dashboard = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminDashboard.jsx'), 'utf8');
assert.ok(dashboard.includes('/app/superadmin/pilot-readiness'), 'dashboard should link to pilot readiness');
const page = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminPilotReadinessPage.jsx'), 'utf8');
for (const label of ['Pilot Readiness Checklist', 'Blockers', 'Warnings', 'platform metadata only']) assert.ok(page.includes(label), `page should include ${label}`);

console.log('superadminPilotReadiness.routes.ui.schema.test.js passed');
