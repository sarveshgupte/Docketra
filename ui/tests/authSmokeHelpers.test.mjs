import assert from 'assert';
import { resolvePostAuthNavigation } from '../src/utils/postAuthNavigation.js';
import { resolveAuthRedirectDestination, isPublicAuth401Suppressed } from '../src/utils/authRedirects.js';
import { clearPendingLoginSessionState, clearSuperadminRoutingHints } from '../src/utils/authSessionCleanup.js';

const resolvePostAuthRoute = (user) => (user?.isSuperAdmin || user?.role === 'SUPERADMIN' ? '/app/superadmin' : `/app/firm/${user.firmSlug}/dashboard`);

assert.strictEqual(resolvePostAuthNavigation({ user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ user: { role: 'SUPERADMIN', isSuperAdmin: true }, resolvePostAuthRoute }), '/app/superadmin');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=https://evil.com', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=/app/superadmin', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=/app/firm/acme/reports', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/reports');

assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/firm/acme/dashboard', storedFirmSlug: 'wrong' }), '/acme/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/superadmin', storedFirmSlug: 'acme' }), '/superadmin/login');
assert.strictEqual(isPublicAuth401Suppressed({ pathname: '/acme/login', isAuthStateRequest: true }), true);

const sessionRemoved = [];
clearPendingLoginSessionState({ removeItem: (key) => sessionRemoved.push(key) });
assert.deepStrictEqual(sessionRemoved.sort(), ['PENDING_LOGIN_TOKEN', 'PENDING_LOGIN_FIRM', 'POST_LOGIN_RETURN_TO'].sort());

const storageRemoved = [];
clearSuperadminRoutingHints({ removeItem: (key) => storageRemoved.push(key) });
assert.deepStrictEqual(storageRemoved.sort(), ['firmSlug', 'impersonatedFirm'].sort());

console.log('authSmokeHelpers.test.mjs passed');
