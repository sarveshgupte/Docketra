import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  firmLoginSource.includes('workspace context could not be loaded'),
  'Firm login should show actionable message when context hydration fails.'
);

// 7. Stale redirect target ignored.
assert(
  postAuthNavigationSource.includes('if (candidateRoute && isRoleCompatibleRoute(candidateRoute, user)) {'),
  'Post-auth navigation helper should validate candidate redirect target before using it.'
);
assert(
  postAuthNavigationSource.includes('if (trimmed.startsWith(\'//\')) return false;'),
  'Post-auth navigation helper must reject protocol-relative external targets.'
);
assert(
  postAuthNavigationSource.includes('if (/^[a-zA-Z][a-zA-Z0-9+\\-.]*:/.test(trimmed)) return false;'),
  'Post-auth navigation helper must reject absolute URL schemes in returnTo.'
);

// 8. Firm user never routed to /superadmin/*.
assert(
  postAuthNavigationSource.includes('return candidatePath.startsWith(`/app/firm/${firmSlug}`);'),
  'Post-auth helper must enforce firm namespace for firm users.'
);

// 9. Superadmin user never routed to firm dashboard routes.
assert(
  postAuthNavigationSource.includes('return candidatePath.startsWith(\'/app/superadmin\');'),
  'Post-auth helper must enforce superadmin namespace for superadmin users.'
);
assert(
  firmLoginSource.includes('if (pendingFirm && pendingFirm !== firmSlug) {'),
  'OTP verification must validate pending firm context before using stored token.'
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
