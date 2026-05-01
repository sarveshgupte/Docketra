import assert from 'assert';
import { resolveAuthRedirectDestination, isPublicAuth401Suppressed } from '../src/utils/authRedirects.js';
import { extractFirmSlugFromPath } from '../src/utils/tenantRouting.js';
import { isRoleCompatibleRoute } from '../src/utils/returnToSafety.js';

// resolveAuthRedirectDestination
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/firm/acme/dashboard', storedFirmSlug: 'wrong' }), '/acme/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/superadmin', storedFirmSlug: 'acme' }), '/superadmin/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/superadmin/login', storedFirmSlug: 'acme' }), '/superadmin/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/firm/acme/reports', storedFirmSlug: null }), '/acme/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/unknown/protected', storedFirmSlug: 'acme' }), '/acme/login');

// extractFirmSlugFromPath
assert.strictEqual(extractFirmSlugFromPath('/app/firm/acme/dashboard'), 'acme');
assert.strictEqual(extractFirmSlugFromPath('/acme/login'), 'acme');
assert.strictEqual(extractFirmSlugFromPath('/acme/forgot-password'), 'acme');
assert.strictEqual(extractFirmSlugFromPath('/superadmin/login'), null);
assert.strictEqual(extractFirmSlugFromPath('/app/login'), null);
assert.strictEqual(extractFirmSlugFromPath('/login'), null);
assert.strictEqual(extractFirmSlugFromPath('/ACME!/login'), null);

// public auth page 401 loop suppression
['/login','/superadmin/login','/acme/login','/forgot-password','/acme/forgot-password','/signup'].forEach((pathname) => {
  assert.strictEqual(isPublicAuth401Suppressed({ pathname, isAuthStateRequest: true }), true);
});
assert.strictEqual(isPublicAuth401Suppressed({ pathname: '/app/firm/acme/dashboard', isAuthStateRequest: true }), false);

// returnTo safety namespace checks
assert.strictEqual(isRoleCompatibleRoute('/app/firm/acme/dashboard', { isSuperAdminUser: true, firmSlug: null }), false);
assert.strictEqual(isRoleCompatibleRoute('/app/superadmin', { isSuperAdminUser: false, firmSlug: 'acme' }), false);
assert.strictEqual(isRoleCompatibleRoute('/app/firm/wrong/dashboard', { isSuperAdminUser: false, firmSlug: 'acme' }), false);
assert.strictEqual(isRoleCompatibleRoute('/app/firm/acme/reports', { isSuperAdminUser: false, firmSlug: 'acme' }), true);

console.log('authRedirectBehavior.test.mjs passed');
