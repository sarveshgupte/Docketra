const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schemas = require('../src/schemas/superadmin.routes.schema');

const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(routes.includes("router.get('/feature-flags', requireSuperadmin"), 'GET feature-flags should require requireSuperadmin');
assert.ok(routes.includes("router.patch('/feature-flags/:key', requireSuperadmin"), 'PATCH feature-flags should require requireSuperadmin');
assert.ok(routes.includes('superadminAdminManagementLimiter, updateSuperadminFeatureFlag'), 'PATCH should include management limiter');

const schema = schemas['PATCH /feature-flags/:key'];
assert.ok(schema, 'schema should exist');
assert.throws(() => schema.body.parse({ notes: 'x'.repeat(501) }), 'notes max length should be enforced');
assert.throws(() => schema.body.parse({ firmIds: new Array(101).fill('507f1f77bcf86cd799439011') }), 'firmIds max 100 should be enforced');

const controller = fs.readFileSync(path.resolve(__dirname, '../src/controllers/superadmin.controller.js'), 'utf8');
assert.ok(controller.includes('Unknown feature flag key'), 'unknown flag key must be rejected');
assert.ok(controller.includes('logSuperadminAction'), 'audit action should be attempted');
assert.ok(controller.includes('return res.json({ success: true, data })'), 'feature-flag handlers should return metadata wrapper only');

const lazy = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazy.includes('SuperadminFeatureFlagsPage'), 'lazy export should exist');
const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/feature-flags"'), 'protected route should exist');

const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Feature Flags'), 'nav link should exist');
assert.ok(!layout.includes('href="#"'), 'no placeholder href links');

const dashboard = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminDashboard.jsx'), 'utf8');
assert.ok(dashboard.includes('/app/superadmin/feature-flags'), 'dashboard should link to feature flags');

const page = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminFeatureFlagsPage.jsx'), 'utf8');
assert.ok(page.includes('Feature Flags controls platform rollout metadata only'), 'privacy text should exist');
assert.ok(page.includes('setSaveError('), 'save error handling should exist');
assert.ok(page.includes('Saving...'), 'saving state should exist');

console.log('superadminFeatureFlags.routes.ui.schema.test.js passed');
