import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isRoleCompatibleRoute, isSafeReturnToPath } from '../src/utils/returnToSafety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');

const firmLoginSource = fs.readFileSync(path.join(root, 'pages', 'FirmLoginPage.jsx'), 'utf8');
const loginPageSource = fs.readFileSync(path.join(root, 'pages', 'LoginPage.jsx'), 'utf8');
const otpSource = fs.readFileSync(path.join(root, 'pages', 'OtpVerificationPage.jsx'), 'utf8');
const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');
const protectedRouteSource = fs.readFileSync(path.join(root, 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const postAuthNavigationSource = fs.readFileSync(path.join(root, 'utils', 'postAuthNavigation.js'), 'utf8');

// 1. Successful firm login without OTP -> firm dashboard/workspace.
assert(
  firmLoginSource.includes('const nextRoute = resolvePostAuthNavigation({'),
  'Firm login must resolve deterministic post-auth navigation target.'
);

// 2. Successful firm login with OTP should go OTP first.
assert(
  firmLoginSource.includes('if (response?.otpRequired && response?.loginToken) {'),
  'Firm login should enter OTP step when backend requires OTP.'
);
assert(
  firmLoginSource.includes('const firmSlug = sanitizeFirmSlug(rawFirmSlug);'),
  'Firm login must sanitize route firmSlug before tenant lookup.'
);

// 3. Successful OTP verification routes to workspace.
assert(
  otpSource.includes('resolvePostAuthNavigation'),
  'OTP verification should resolve post-auth route via centralized helper.'
);

// 4. Success toast not completion unless hydration + navigation succeeds.
assert(
  firmLoginSource.includes('if (!profileResult?.success || !profileResult?.data) {'),
  'Firm login should fail visibly when profile hydration fails after auth success.'
);
assert(
  loginPageSource.includes('if (!profileResult?.success || !profileResult?.data) {'),
  'Superadmin login should fail visibly when profile hydration fails after auth success.'
);

// 5. Auth guard should not bounce immediately after successful login.
assert(
  protectedRouteSource.includes('if (!isAuthResolved)'),
  'ProtectedRoute must wait for auth resolution before redirects.'
);

// 6. Missing workspace context shows actionable error.
assert(
  firmLoginSource.includes('session could not be established'),
  'Firm login should show actionable message when context hydration fails.'
);

// 7. Return-to safety and role compatibility are delegated to returnToSafety helpers.
assert(
  postAuthNavigationSource.includes("from './returnToSafety.js'"),
  'Post-auth navigation helper must import returnToSafety helpers.'
);
assert(
  postAuthNavigationSource.includes('isSafeReturnToPath(returnTo)'),
  'Post-auth navigation helper should validate returnTo via isSafeReturnToPath.'
);
assert(
  postAuthNavigationSource.includes('isRoleCompatibleRoute(candidateRoute,'),
  'Post-auth navigation helper should validate candidate routes via isRoleCompatibleRoute.'
);
assert(
  postAuthNavigationSource.includes('isRoleCompatibleRoute(fallbackRoute,'),
  'Post-auth navigation helper should validate fallback routes via isRoleCompatibleRoute.'
);

// 8. returnToSafety.js rejects unsafe redirect targets.
assert.equal(isSafeReturnToPath('//evil.com'), false, 'Must reject protocol-relative external targets.');
assert.equal(isSafeReturnToPath('https://evil.com'), false, 'Must reject absolute URL scheme targets.');
assert.equal(isSafeReturnToPath('/app'), true, 'Must allow /app returnTo path.');
assert.equal(isSafeReturnToPath('/app/workspace'), true, 'Must allow /app/* returnTo path.');
assert.equal(isSafeReturnToPath('/settings'), false, 'Must reject non-/app returnTo paths.');

// 9. returnToSafety.js enforces role-specific namespaces.
assert.equal(
  isRoleCompatibleRoute('/app/superadmin/audit', { isSuperAdminUser: true, firmSlug: 'acme' }),
  true,
  'Superadmin users must be allowed only in /app/superadmin namespace.'
);
assert.equal(
  isRoleCompatibleRoute('/app/firm/acme/dashboard', { isSuperAdminUser: true, firmSlug: 'acme' }),
  false,
  'Superadmin users must not be routed into firm namespace.'
);
assert.equal(
  isRoleCompatibleRoute('/app/firm/acme/dashboard', { isSuperAdminUser: false, firmSlug: 'acme' }),
  true,
  'Firm users must be allowed only in their own firm namespace.'
);
assert.equal(
  isRoleCompatibleRoute('/app/firm/other/dashboard', { isSuperAdminUser: false, firmSlug: 'acme' }),
  false,
  'Firm users must not be routed into a different firm namespace.'
);
assert.equal(
  isRoleCompatibleRoute('/app/superadmin/audit', { isSuperAdminUser: false, firmSlug: 'acme' }),
  false,
  'Firm users must not be routed into superadmin namespace.'
);
assert(
  firmLoginSource.includes('if (pendingFirm && pendingFirm !== firmSlug) {'),
  'OTP verification must validate pending firm context before using stored token.'
);
assert.equal(
  firmLoginSource.includes('sessionStorage.setItem(SESSION_KEYS.POST_LOGIN_RETURN_TO'),
  false,
  'Firm login should not persist stale POST_LOGIN_RETURN_TO state.'
);
assert(
  firmLoginSource.includes('clearPendingLoginState();\n                setLoginToken(\'\');'),
  'Backing out of OTP step should clear pending OTP session keys.'
);

// 10. Logout clears pending login/OTP/redirect state.
assert(
  authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);'),
  'Logout/reset should clear pending login token state.'
);
assert(
  authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);'),
  'Logout/reset should clear pending login firm state.'
);
assert(
  authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);'),
  'Logout/reset should clear pending returnTo state.'
);

console.log('postLoginFlowRegression.test.mjs passed');
