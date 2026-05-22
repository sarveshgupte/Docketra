import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(cwd, relativePath), 'utf8');

const loginPageSource = read('src/pages/LoginPage.jsx');
const firmLoginPageSource = read('src/pages/FirmLoginPage.jsx');
const authContextSource = read('src/contexts/AuthContext.jsx');
const superAdminLayoutSource = read('src/components/common/SuperAdminLayout.jsx');
const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
const protectedRouteSource = read('src/components/auth/ProtectedRoute.jsx');
const platformNavigationSource = read('src/constants/platformNavigation.js');

// 1) SuperAdmin auth and visible pilot shell expectations.
assert.ok(loginPageSource.includes("'/superadmin/login'") && loginPageSource.includes('resolvePostAuthNavigation({') && loginPageSource.includes('resolvePostAuthRoute'), 'SuperAdmin login should use superadmin auth endpoint and deterministic post-auth route resolution.');
assert.ok(superAdminLayoutSource.includes('navigate(\'/superadmin/login\''), 'SuperAdmin logout should redirect to /superadmin/login.');
for (const visibleNavLabel of ['Platform Dashboard', 'Firms', 'Pilot Readiness', 'Support Diagnostics']) {
  assert.ok(superAdminLayoutSource.includes(visibleNavLabel), `SuperAdmin nav should include pilot-visible item: ${visibleNavLabel}.`);
}
for (const gatedRoute of ['/app/superadmin/onboarding-insights', '/app/superadmin/firm-health', '/app/superadmin/feature-flags', '/app/superadmin/plans', '/app/superadmin/audit']) {
  assert.ok(
    superAdminLayoutSource.includes(`showSuperadminNavItem('${gatedRoute}')`),
    `SuperAdmin hidden pilot route should be guarded by showSuperadminNavItem: ${gatedRoute}.`,
  );
}

// 2) Firm user auth and pilot navigation expectations.
assert.ok(firmLoginPageSource.includes('resolvePostAuthNavigation({'), 'Firm login should resolve deterministic post-auth route.');
assert.ok(platformNavigationSource.includes("label: 'My Worklist'"), 'Firm pilot navigation should include My Worklist.');
assert.ok(platformNavigationSource.includes("label: 'Workbaskets'"), 'Firm pilot navigation should include Workbaskets/Global Worklist.');
assert.ok(platformNavigationSource.includes("label: 'Clients'"), 'Firm pilot navigation should include Clients when permissions allow.');
assert.ok(platformNavigationSource.includes("label: 'Settings'"), 'Firm pilot navigation should include Profile/Settings surface.');
for (const hiddenNav of ['CRM', 'CMS', 'Company Brain', 'Knowledge Library', 'AI Settings', 'Storage Settings', 'Data Storage Map', 'Product Updates']) {
  assert.equal(platformNavigationSource.includes(hiddenNav), false, `Firm pilot navigation should not include hidden non-MVP module label: ${hiddenNav}.`);
}

// 3) Route gating smoke for hidden firm routes + settings/work allowlist.
for (const blockedRouteFragment of [
  'path="crm"',
  'path="cms"',
  'path="company-brain"',
  'path="knowledge"',
  'path="ai-settings"',
  'path="storage-settings"',
  'path="admin/reports"',
  'path="settings"',
  'path="settings/firm"',
]) {
  assert.ok(
    protectedRoutesSource.includes(blockedRouteFragment),
    `ProtectedRoutes should continue to explicitly define guarded path ${blockedRouteFragment}.`,
  );
}
assert.ok(protectedRoutesSource.includes('path="settings/work"'), 'settings/work route must remain explicitly accessible.');
assert.ok(
  protectedRouteSource.includes('const loginPathWithReturnTo = appendReturnTo(loginPath, buildReturnTo(location));'),
  'ProtectedRoute should preserve returnTo routing for deep-link guard redirects.',
);

// 4) Session persistence smoke and redirect loop protection contracts.
assert.ok(authContextSource.includes('fetchProfile()'), 'AuthContext should hydrate auth session from profile on app mount.');
assert.ok(authContextSource.includes('profileFetchInFlightRef'), 'AuthContext should dedupe in-flight profile refresh to reduce loop risk.');
assert.ok(protectedRouteSource.includes('if (!isAuthResolved)'), 'ProtectedRoute must wait for auth hydration to avoid redirect loops on reload.');

// 5) Firm logout behavior and private state clear contract.
assert.ok(authContextSource.includes('queryClient.clear();'), 'Logout should clear cached private UI query state.');
assert.ok(authContextSource.includes("window.dispatchEvent(new CustomEvent('auth:logout'));"), 'Logout should broadcast auth:logout for private UI cleanup.');
assert.ok(protectedRouteSource.includes('return <Navigate to={loginPathWithReturnTo} replace />;'), 'Protected firm routes should redirect unauthenticated users to firm login with returnTo intent.');

// 6) Mobile viewport smoke contract (responsive nav + logout controls remain present).
assert.ok(superAdminLayoutSource.includes('md:hidden'), 'SuperAdmin shell should keep mobile-visible logout control.');
assert.ok(superAdminLayoutSource.includes('md:block'), 'SuperAdmin shell should keep desktop/mobile breakpoint shell controls.');

console.log('pilotAuthRoutingSmoke.test.mjs passed');
