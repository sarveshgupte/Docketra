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

const ffService = fs.readFileSync(path.resolve(__dirname, '../src/services/featureFlags.service.js'), 'utf8');
assert.ok(ffService.includes('const updateFeatureFlagState = ({ key, enabledGlobally, rolloutStage }) => {'), 'updateFeatureFlagState should be synchronous');
assert.ok(ffService.includes('validateFirmIds'), 'invalid firmIds validation helper should exist');
assert.ok(ffService.includes('SuperadminPlatformConfig'), 'platform-level storage should exist');

const controller = fs.readFileSync(path.resolve(__dirname, '../src/controllers/superadmin.controller.js'), 'utf8');
assert.ok(controller.includes('Unknown feature flag key'), 'unknown flag key must be rejected');
assert.ok(controller.includes('Firm overrides are not allowed for'), 'disallowed firm override should be rejected');
assert.ok(controller.includes('Invalid firmIds provided'), 'invalid firm ids should be rejected');
assert.ok(controller.includes('firmIds must contain at least one firm when provided.'), 'empty firmIds should be rejected');
assert.ok(controller.includes('missingFirmIds'), 'missing firm ids should be rejected');
assert.ok(controller.includes("actionType: 'FeatureFlagUpdated'"), 'audit action should use FeatureFlagUpdated');
const featureFlagHandlerSlice = controller.slice(controller.indexOf('const updateSuperadminFeatureFlag'), controller.indexOf('// Constants'));
assert.ok(!featureFlagHandlerSlice.includes("actionType: 'FirmActivated'"), 'audit action should not use FirmActivated for feature flags');
assert.ok(!featureFlagHandlerSlice.includes('$nin: normalizedFirmIds'), 'PATCH with firmIds must not update non-selected firms with $nin');
assert.ok(controller.includes('SuperadminPlatformConfig.updateOne'), 'global updates should use platform-level storage');
assert.ok(controller.includes('Firm.updateMany({ _id: { $in: normalizedFirmIds }'), 'firm override should scope updates to selected firms');

const firmModel = fs.readFileSync(path.resolve(__dirname, '../src/models/Firm.model.js'), 'utf8');
assert.ok(firmModel.includes('featureFlags:'), 'Firm schema should explicitly support featureFlags metadata');

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
assert.ok(!page.match(/client records.*token|password|otp|secret/i), 'page should not expose sensitive/private content');

console.log('superadminFeatureFlags.routes.ui.schema.test.js passed');
