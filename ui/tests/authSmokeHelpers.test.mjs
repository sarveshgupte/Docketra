import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src', 'utils');
const postAuthNavigationSource = fs.readFileSync(path.join(root, 'postAuthNavigation.js'), 'utf8');
const authRedirectsSource = fs.readFileSync(path.join(root, 'authRedirects.js'), 'utf8');
const cleanupSource = fs.readFileSync(path.join(root, 'authSessionCleanup.js'), 'utf8');

assert(postAuthNavigationSource.includes('return ROUTES.DASHBOARD(user.firmSlug);'));
assert(postAuthNavigationSource.includes('return ROUTES.SUPERADMIN_DASHBOARD;'));
assert(postAuthNavigationSource.includes('const candidateRoute = isSafeReturnToPath(returnTo) ? returnTo :')); 
assert(postAuthNavigationSource.includes('isRoleCompatibleRoute(candidateRoute'));

assert(authRedirectsSource.includes("return '/superadmin/login';"));
assert(authRedirectsSource.includes('return resolveFirmLoginPath'));
assert(authRedirectsSource.includes('Boolean(isAuthStateRequest) && isPublicAuthPagePath(pathname)'));

assert(cleanupSource.includes('SESSION_KEYS.PENDING_LOGIN_TOKEN'));
assert(cleanupSource.includes('SESSION_KEYS.PENDING_LOGIN_FIRM'));
assert(cleanupSource.includes('SESSION_KEYS.POST_LOGIN_RETURN_TO'));
assert(cleanupSource.includes('STORAGE_KEYS.FIRM_SLUG'));
assert(cleanupSource.includes('STORAGE_KEYS.IMPERSONATED_FIRM'));

console.log('authSmokeHelpers.test.mjs passed');
