import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');

const publicRoutesSource = fs.readFileSync(path.join(root, 'routes', 'PublicRoutes.jsx'), 'utf8');
const loginPageSource = fs.readFileSync(path.join(root, 'pages', 'LoginPage.jsx'), 'utf8');
const forgotPasswordSource = fs.readFileSync(path.join(root, 'pages', 'ForgotPasswordPage.jsx'), 'utf8');
const otpPageSource = fs.readFileSync(path.join(root, 'pages', 'OtpVerificationPage.jsx'), 'utf8');
const postAuthNavigationSource = fs.readFileSync(path.join(root, 'utils', 'postAuthNavigation.js'), 'utf8');

const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');
const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');
const platformShellSource = fs.readFileSync(path.join(root, 'components', 'platform', 'PlatformShell.jsx'), 'utf8');
const superAdminLayoutSource = fs.readFileSync(path.join(root, 'components', 'common', 'SuperAdminLayout.jsx'), 'utf8');
const returnToSafetySource = fs.readFileSync(path.join(root, 'utils', 'returnToSafety.js'), 'utf8');


assert(publicRoutesSource.includes('path="/superadmin"'), 'Superadmin root login route should exist.');
assert(publicRoutesSource.includes('path="/superadmin/login"'), 'Canonical superadmin login route should exist.');
assert(publicRoutesSource.includes('path="/:firmSlug/login"'), 'Firm login route should exist.');
assert(publicRoutesSource.includes('path="/:firmSlug/forgot-password"'), 'Firm forgot-password route should exist.');

assert(loginPageSource.includes('localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);'), 'Superadmin login should clear stale firm routing hint state.');
assert(loginPageSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);'), 'Superadmin login should clear pending login token hints.');
assert(loginPageSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);'), 'Superadmin login should clear pending firm OTP hints.');
assert(loginPageSource.includes('sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);'), 'Superadmin login should clear stale post-login return hints.');

assert(forgotPasswordSource.includes('const activeFirmSlug = resolvedFirmSlug || firmSlug ||'), 'Forgot-password flow should preserve firm context when present.');
assert(forgotPasswordSource.includes('const loginPath = activeFirmSlug ? `/${activeFirmSlug}/login` : \'/superadmin\''), 'Forgot-password should route back to firm login when scoped.');

assert(otpPageSource.includes('await fetchProfile({ force: true });'), 'OTP verification must hydrate profile before navigation.');
assert(otpPageSource.includes('authApi.loginVerify({ firmSlug: firmSlug || undefined, loginToken, otp })'), 'Login OTP verify should use login challenge verify endpoint.');
assert.equal(otpPageSource.includes("api.post('/auth/verify-otp', { email, otp, purpose })"), true, 'Signup/generic OTP verify path should remain available for non-login OTP purposes.');
assert(otpPageSource.includes("if (purpose === 'login' && !loginToken) {"), 'Login OTP flow should guard against missing login session token.');
assert(otpPageSource.includes("setError('Login session expired. Please restart login.');"), 'Missing login token should show explicit restart message.');
assert(otpPageSource.includes('authApi.loginResendOtp'), 'Login OTP resend should call login resend endpoint.');
assert(otpPageSource.includes('authApi.signupResendOtp(email)'), 'Signup OTP resend should remain separate from login OTP resend.');

assert(postAuthNavigationSource.includes('if (candidateRoute && isRoleCompatibleRoute(candidateRoute,'), 'ReturnTo must be role-checked.');
assert(returnToSafetySource.includes("if (isSuperAdminUser) return candidatePath.startsWith('/app/superadmin');"), 'Superadmin routing namespace guard should be enforced.');
assert(returnToSafetySource.includes('return candidatePath.startsWith(`/app/firm/${normalizedFirmSlug}`);'), 'Firm routing namespace guard should be enforced.');


assert(apiSource.includes("resolveAuthRedirectDestination"), 'API client should resolve auth redirects by namespace.');
assert(apiSource.includes("resolveAuthRedirectDestination"), 'API auth redirect should use shared destination resolver.');
assert(apiSource.includes("const inSuperadminNamespace = currentPath.startsWith('/app/superadmin')"), 'Superadmin expiry should not reuse stale firm slug.');
assert(authContextSource.includes('localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);'), 'Auth clear state should remove impersonation hints.');
assert(authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);'), 'Auth clear state should remove pending login token on logout/expiry.');
assert(authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);'), 'Auth clear state should remove pending login firm on logout/expiry.');
assert(authContextSource.includes('sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);'), 'Auth clear state should remove returnTo hints on logout/expiry.');
assert(platformShellSource.includes("user?.isSuperAdmin || user?.role === 'SuperAdmin'"), 'Superadmin logout from platform shell should clear firmSlug state.');
assert(superAdminLayoutSource.includes("navigate('/superadmin/login'"), 'Superadmin logout should redirect to /superadmin/login.');

console.log('authReliabilityRouteGuards.test.mjs passed');
