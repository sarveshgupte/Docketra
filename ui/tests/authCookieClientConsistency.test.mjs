import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');

const authServiceSource = fs.readFileSync(path.join(root, 'services', 'authService.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');
const protectedRouteSource = fs.readFileSync(path.join(root, 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');

assert(!authServiceSource.includes('isAuthenticated:'), 'authService should not expose a misleading isAuthenticated helper in cookie-auth mode.');
assert(!apiSource.includes("Authorization']"), 'API client must not inject Authorization headers from client-side state.');
assert(!apiSource.includes('ACCESS_TOKEN'), 'API client must not depend on browser token storage keys.');
assert(protectedRouteSource.includes('const { isAuthenticated, isAuthResolved, user, authState } = useAuth();'), 'ProtectedRoute should derive auth from AuthContext state.');
assert(protectedRouteSource.includes('if (!isAuthResolved)'), 'ProtectedRoute should wait for profile hydration before auth redirects.');
assert(protectedRouteSource.includes('if (!isAuthenticated)'), 'ProtectedRoute must redirect unauthenticated users.');

console.log('authCookieClientConsistency.test.mjs passed');
