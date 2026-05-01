import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');

const publicRoutesSource = fs.readFileSync(path.join(root, 'routes', 'PublicRoutes.jsx'), 'utf8');
const defaultRouteSource = fs.readFileSync(path.join(root, 'components', 'routing', 'DefaultRoute.jsx'), 'utf8');
const protectedRouteSource = fs.readFileSync(path.join(root, 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const tenantRoutingSource = fs.readFileSync(path.join(root, 'utils', 'tenantRouting.js'), 'utf8');
const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');
const routeConstantsSource = fs.readFileSync(path.join(root, 'constants', 'routes.js'), 'utf8');
const legacyRoutesSource = fs.readFileSync(path.join(root, 'routes', 'LegacyRoutes.jsx'), 'utf8');

// 1) Opening `/` while logged out renders landing page (no auth redirect in DefaultRoute).
assert(
  publicRoutesSource.includes('<Route path="/" element={<MarketingHomePage />} />'),
  'Public route `/` must render MarketingHomePage.'
);
assert(
  defaultRouteSource.includes('if (!isAuthenticated) {\n    return <Navigate to={ROUTES.LANDING} replace />;\n  }'),
  'DefaultRoute must send unauthenticated users to landing, not to firm/superadmin login.'
);
assert(
  !defaultRouteSource.includes('ROUTES.DASHBOARD(storedFirmSlug)'),
  'DefaultRoute must never route authenticated users via localStorage-only firm slug fallback.'
);

// 2) Stale firm slug in localStorage should not hijack `/`.
assert(
  !defaultRouteSource.includes('localStorage.getItem(STORAGE_KEYS.FIRM_SLUG)'),
  'DefaultRoute should not read localStorage firm slug for authenticated destination decisions.'
);

// 3) Stale superadmin state should not hijack `/`.
assert(
  defaultRouteSource.includes('return <Navigate to={ROUTES.LANDING} replace />;'),
  'DefaultRoute unauthenticated fallback should be landing page regardless of stale auth hints.'
);

// 4) `/superadmin/login` should render superadmin login.
assert(
  publicRoutesSource.includes('<Route path="/superadmin/login" element={<LoginPage />} />'),
  'Public routes must expose /superadmin/login explicitly.'
);

// 5) `/:firmSlug/login` should remain explicit.
assert(
  publicRoutesSource.includes('<Route path="/:firmSlug/login" element={<FirmLoginPage />} />'),
  'Public routes must expose firm-scoped login route.'
);

// 6) Protected firm route while logged out redirects to firm login with returnTo.
assert(
  protectedRouteSource.includes('appendReturnTo(loginPath, buildReturnTo(location))'),
  'ProtectedRoute must preserve valid returnTo when redirecting unauthenticated access.'
);

// 7) Protected superadmin routes while logged out redirect to superadmin login.
assert(
  protectedRouteSource.includes('const loginPath = requireSuperadmin ? ROUTES.SUPERADMIN_LOGIN : firmLoginPath;'),
  'ProtectedRoute must force superadmin login path for superadmin namespace.'
);
assert(
  protectedRouteSource.includes('const routeFirmSlug = sanitizeFirmSlug(firmSlug);'),
  'ProtectedRoute must sanitize route firmSlug param before use.'
);
assert(
  protectedRouteSource.includes('firmSlug: routeFirmSlug,'),
  'ProtectedRoute must use sanitized route firmSlug when resolving firm login path.'
);
assert(
  protectedRouteSource.includes('if (hasInvalidRouteFirmSlug && !requireSuperadmin) {'),
  'ProtectedRoute must safely handle invalid protected firm slugs.'
);

assert(
  publicRoutesSource.includes('<Route path="/superadmin" element={<LoginPage />} />')
  && publicRoutesSource.includes('<Route path="/superadmin/login" element={<LoginPage />} />'),
  'Superadmin login alias + canonical route should coexist intentionally for backward compatibility.'
);

// 8) Invalid firm slug should be discarded.
assert(
  tenantRoutingSource.includes('export const sanitizeFirmSlug = (value) => {'),
  'tenantRouting should expose firm slug sanitization helper.'
);
assert(
  tenantRoutingSource.includes('if (!FIRM_SLUG_PATTERN.test(normalized)) return null;'),
  'tenantRouting should reject invalid firm slug format.'
);
assert(
  tenantRoutingSource.includes("return '/login';"),
  'tenantRouting should fallback to /login when no valid firm slug exists.'
);
assert(
  routeConstantsSource.includes("SUPERADMIN_LOGIN: '/superadmin/login'"),
  'Canonical superadmin login route should be /superadmin/login.'
);

// 9) Logout clears firm/session redirect state.
assert(
  authContextSource.includes('localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);'),
  'Auth logout cleanup must clear impersonation redirect state.'
);
assert(
  authContextSource.includes('localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);'),
  'Auth logout cleanup must clear stored firm slug unless explicitly preserved.'
);

// 10) No login redirect loop between `/`, `/:firmSlug/login`, `/superadmin/login`.
assert(
  apiSource.includes('alreadyOnLoginRoute'),
  'API interceptor should guard against redirect loops when already on a login route.'
);
assert(
  apiSource.includes('/:firmSlug/forgot-password') || apiSource.includes('/forgot-password'),
  'API interceptor should classify forgot-password pages as public auth pages.'
);
assert(
  publicRoutesSource.includes('<Route path="/login" element={<LoginPage />} />'),
  'Public `/login` route must exist as a safe fallback login entrypoint.'
);
assert(
  legacyRoutesSource.includes('canAccessFirmApp'),
  'Legacy firm slug route should only route to firm app after authenticated tenant confirmation.'
);
assert(
  legacyRoutesSource.includes('!isSuperAdmin(user)'),
  'Legacy firm slug route must prevent superadmin sessions from entering firm dashboard routes.'
);

console.log('routingPublicBoundaryRegression.test.mjs passed');
