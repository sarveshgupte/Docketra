import fs from 'fs';
import path from 'path';
import assert from 'assert';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd
  ? path.resolve(process.cwd(), 'src')
  : path.resolve(process.cwd(), 'ui/src');

const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const publicRoutes = read('routes', 'PublicRoutes.jsx');
const protectedRoute = read('components', 'auth', 'ProtectedRoute.jsx');
const defaultRoute = read('components', 'routing', 'DefaultRoute.jsx');
const authRedirect = read('utils', 'authRedirect.js');
const authContext = read('contexts', 'AuthContext.jsx');
const firmLogin = read('pages', 'FirmLoginPage.jsx');
const superadminLogin = read('pages', 'LoginPage.jsx');
const api = read('services', 'api.js');
const platformShell = read('components', 'platform', 'PlatformShell.jsx');
const legacyLayout = read('components', 'common', 'Layout.jsx');
const constants = read('utils', 'constants.js');

assert(
  publicRoutes.includes('<Route path="/" element={<MarketingHomePage />} />'),
  'Root / must render the marketing landing page as a public route.'
);
assert(
  publicRoutes.includes('<Route path="/superadmin/login" element={<LoginPage />} />'),
  '/superadmin/login must render the superadmin login page directly.'
);
assert(
  publicRoutes.includes('<Route path="/:firmSlug/login" element={<FirmLoginPage />} />'),
  '/:firmSlug/login must render the firm login page directly.'
);
assert(
  !publicRoutes.includes('path="/" element={<DefaultRoute />}') && !publicRoutes.includes('path="/" element={<RootRedirect />}'),
  'Root / must not use auth-aware redirect components.'
);

assert(
  protectedRoute.includes('const loginPath = requireSuperadmin') && protectedRoute.includes('? ROUTES.SUPERADMIN_LOGIN'),
  'Superadmin protected routes must redirect logged-out users only to /superadmin/login.'
);
assert(
  protectedRoute.includes('resolveFirmLoginPath({') && protectedRoute.includes('fallbackFirmSlug: storedFirmSlug'),
  'Firm protected routes should still redirect logged-out users to the firm login when a firm slug exists.'
);
assert(
  protectedRoute.includes('return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;'),
  'Superadmin users must not be routed into firm app routes.'
);
assert(
  protectedRoute.includes('ROUTES.DASHBOARD(effectiveFirmSlug)'),
  'Firm users denied superadmin access should return to their firm dashboard.'
);

assert(
  authRedirect.includes('export const getDefaultPostAuthRoute') && authRedirect.includes('ROUTES.DASHBOARD(candidateUser.firmSlug)'),
  'Default post-auth destination must be centralized and route firm users to the firm dashboard.'
);
assert(
  authRedirect.includes('export const isValidPostLoginDestination') && authRedirect.includes('match[1] === candidateUser.firmSlug'),
  'Redirect targets must be validated against the authenticated firm slug.'
);
assert(
  authRedirect.includes('isSuperAdmin(candidateUser)') && authRedirect.includes('ROUTES.SUPERADMIN_DASHBOARD'),
  'Redirect targets must keep superadmin users in the superadmin namespace.'
);
assert(
  authRedirect.includes('clearRoutingAuthStorage') && authRedirect.includes('SESSION_KEYS.PENDING_OTP'),
  'Routing/auth cleanup must clear pending OTP and redirect state.'
);

assert(
  authContext.includes('getDefaultPostAuthRoute(candidateUser)'),
  'AuthContext should delegate default post-auth routing to the centralized helper.'
);
assert(
  firmLogin.includes('resolvePostLoginDestination(returnTo, profileResult.data, resolvePostAuthRoute(profileResult.data))'),
  'Firm login must validate returnTo against the hydrated user before navigating.'
);
assert(
  firmLogin.includes('workspace profile could not be loaded'),
  'Firm login must show an actionable error when profile hydration fails after API login success.'
);
assert(
  superadminLogin.includes('resolvePostLoginDestination(returnTo, profileResult.data, resolvePostAuthRoute(profileResult.data))'),
  'Superadmin login must validate returnTo against the hydrated user before navigating.'
);
assert(
  defaultRoute.includes("location.pathname.startsWith('/app/firm/')") && !defaultRoute.includes('ROUTES.DASHBOARD(storedFirmSlug)'),
  'DefaultRoute must not send authenticated or logged-out users to dashboards based only on stale firmSlug storage.'
);

assert(
  api.includes('clearRoutingAuthStorage') && api.includes('keepToast'),
  'API auth recovery must clear stale auth/routing storage without losing expiry feedback.'
);
assert(
  platformShell.includes('await logout();') && legacyLayout.includes('await logout();'),
  'Logout controls must clear firm/session routing state instead of preserving firmSlug.'
);
assert(
  constants.includes('PENDING_LOGIN') && constants.includes('PENDING_OTP') && constants.includes('REDIRECT_TARGET'),
  'Session routing keys should be declared for cleanup and documentation.'
);

console.log('public routing and post-login auth regression tests passed');
