import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');

const authServiceSource = fs.readFileSync(path.join(root, 'services', 'authService.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');
const protectedRouteSource = fs.readFileSync(path.join(root, 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const otpPageSource = fs.readFileSync(path.join(root, 'pages', 'OtpVerificationPage.jsx'), 'utf8');
const loginPageSource = fs.readFileSync(path.join(root, 'pages', 'LoginPage.jsx'), 'utf8');
const firmLoginSource = fs.readFileSync(path.join(root, 'pages', 'FirmLoginPage.jsx'), 'utf8');

assert(!authServiceSource.includes('isAuthenticated:'), 'authService should not expose a misleading isAuthenticated helper in cookie-auth mode.');
assert(!apiSource.includes("Authorization']"), 'API client must not inject Authorization headers from client-side state.');
assert(!apiSource.includes('ACCESS_TOKEN'), 'API client must not depend on browser token storage keys.');
assert(apiSource.includes('withCredentials: true'), 'Axios API client must send cookies via withCredentials: true.');
assert(authServiceSource.includes("api.post('/auth/refresh')"), 'Auth service refresh calls must use the shared credential-aware API client.');
assert(authServiceSource.includes("api.get('/auth/profile')"), 'Auth service profile calls must use the shared credential-aware API client.');
assert(authServiceSource.includes("api.post('/auth/logout')"), 'Auth service logout calls must use the shared credential-aware API client.');
assert(authServiceSource.includes('api.post(endpoint, payload)'), 'Login must use shared API client for superadmin and tenant routes.');
assert(otpPageSource.includes("api.post('/auth/verify-otp'"), 'OTP verification page must use shared credential-aware API client.');
assert(loginPageSource.includes('fetchProfile({ force: true })'), 'Superadmin login page must hydrate profile after login.');
assert(firmLoginSource.includes('fetchProfile({ force: true })'), 'Firm login OTP completion must hydrate profile after login.');
assert(protectedRouteSource.includes('const { isAuthenticated, isAuthResolved, user, authState } = useAuth();'), 'ProtectedRoute should derive auth from AuthContext state.');
assert(protectedRouteSource.includes('if (!isAuthResolved)'), 'ProtectedRoute should wait for profile hydration before auth redirects.');
assert(protectedRouteSource.includes('if (!isAuthenticated)'), 'ProtectedRoute must redirect unauthenticated users.');

console.log('authCookieClientConsistency.test.mjs passed');
