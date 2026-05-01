import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAuthRedirectDestination, isPublicAuth401Suppressed } from '../src/utils/authRedirects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadResolvePostAuthNavigation() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'postAuthNavigation.js'), 'utf8')
    .replace("import { isSuperAdmin } from './authUtils.js';", '')
    .replace("import { ROUTES } from '../constants/routes.js';", '')
    .replace("import { isRoleCompatibleRoute, isSafeReturnToPath } from './returnToSafety.js';", '')
    .replace('export const resolvePostAuthNavigation =', 'const resolvePostAuthNavigation =');

  const factory = new Function('isSuperAdmin', 'ROUTES', 'isRoleCompatibleRoute', 'isSafeReturnToPath', `${source}\nreturn resolvePostAuthNavigation;`);
  const isSafeReturnToPath = (value) => typeof value === 'string' && value.startsWith('/app/') && !value.startsWith('//') && !/^https?:/i.test(value);
  const isRoleCompatibleRoute = (candidate, { isSuperAdminUser, firmSlug }) => isSuperAdminUser ? candidate.startsWith('/app/superadmin') : candidate.startsWith(`/app/firm/${firmSlug}`);
  const isSuperAdmin = (user) => user?.isSuperAdmin || user?.role === 'SUPERADMIN';
  const ROUTES = { DASHBOARD: (slug) => `/app/firm/${slug}/dashboard`, SUPERADMIN_DASHBOARD: '/app/superadmin' };
  return factory(isSuperAdmin, ROUTES, isRoleCompatibleRoute, isSafeReturnToPath);
}

function loadCleanupHelpers() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'authSessionCleanup.js'), 'utf8')
    .replace("import { SESSION_KEYS, STORAGE_KEYS } from './constants.js';", '')
    .replace('export const clearPendingLoginSessionState =', 'const clearPendingLoginSessionState =')
    .replace('export const clearSuperadminRoutingHints =', 'const clearSuperadminRoutingHints =');

  const factory = new Function('SESSION_KEYS', 'STORAGE_KEYS', 'sessionStorage', 'localStorage', `${source}\nreturn { clearPendingLoginSessionState, clearSuperadminRoutingHints };`);
  return factory(
    { PENDING_LOGIN_TOKEN: 'PENDING_LOGIN_TOKEN', PENDING_LOGIN_FIRM: 'PENDING_LOGIN_FIRM', POST_LOGIN_RETURN_TO: 'POST_LOGIN_RETURN_TO' },
    { FIRM_SLUG: 'firmSlug', IMPERSONATED_FIRM: 'impersonatedFirm' },
    {},
    {},
  );
}

const resolvePostAuthNavigation = loadResolvePostAuthNavigation();
const { clearPendingLoginSessionState, clearSuperadminRoutingHints } = loadCleanupHelpers();
const resolvePostAuthRoute = (user) => (user?.isSuperAdmin ? '/app/superadmin' : `/app/firm/${user.firmSlug}/dashboard`);

assert.strictEqual(resolvePostAuthNavigation({ user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ user: { isSuperAdmin: true, role: 'SUPERADMIN' }, resolvePostAuthRoute }), '/app/superadmin');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=https://evil.com', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=/app/superadmin', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/dashboard');
assert.strictEqual(resolvePostAuthNavigation({ locationSearch: '?returnTo=/app/firm/acme/reports', user: { firmSlug: 'acme', role: 'Admin' }, resolvePostAuthRoute }), '/app/firm/acme/reports');

assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/firm/acme/dashboard', storedFirmSlug: 'wrong' }), '/acme/login');
assert.strictEqual(resolveAuthRedirectDestination({ pathname: '/app/superadmin', storedFirmSlug: 'acme' }), '/superadmin/login');
assert.strictEqual(isPublicAuth401Suppressed({ pathname: '/acme/login', isAuthStateRequest: true }), true);

const removedSession = [];
clearPendingLoginSessionState({ removeItem: (k) => removedSession.push(k) });
assert.deepStrictEqual(removedSession.sort(), ['PENDING_LOGIN_FIRM', 'PENDING_LOGIN_TOKEN', 'POST_LOGIN_RETURN_TO'].sort());

const removedStorage = [];
clearSuperadminRoutingHints({ removeItem: (k) => removedStorage.push(k) });
assert.deepStrictEqual(removedStorage.sort(), ['firmSlug', 'impersonatedFirm'].sort());

console.log('authSmokeHelpers.test.mjs passed');
