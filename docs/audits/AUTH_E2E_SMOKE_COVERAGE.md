# Auth smoke coverage (integration-boundary + helper behavior)

## Exact test commands
- `node tests/authE2ESmoke.test.js`
- `node tests/authRouteContract.test.js`
- `node tests/authForgotPasswordOtpReliability.test.js`
- `node tests/superadminSessionParity.test.js`
- `node tests/authSession.refreshAccessToken.test.js`
- `cd ui && node tests/authRedirectBehavior.test.mjs`
- `cd ui && node tests/authReliabilityRouteGuards.test.mjs`
- `cd ui && node tests/authSmokeHelpers.test.mjs`

## Coverage map

### Backend smoke/integration-boundary tests
- `tests/authE2ESmoke.test.js` (stubbed service dependencies)
  - Firm login init returns OTP challenge/login token.
  - Firm login verify accepts valid OTP and sets access/refresh cookies.
- `tests/superadminSessionParity.test.js` (authSession service smoke with stubbed dependencies)
  - SuperAdmin-scoped refresh token issuance + cookie set contract.
  - Refresh rotates/sets auth cookies.
  - Logout cookie-clear contract.
- `tests/authSession.refreshAccessToken.test.js` (existing)
  - Valid refresh token behavior.
  - Invalid/expired/revoked behavior (401 + cleanup behavior).
  - Refresh token reuse/revocation protections.
- `tests/authForgotPasswordOtpReliability.test.js` (existing)
  - Firm-scoped forgot-password init/verify/reset.
  - Cross-tenant verify/reset blocked.
  - Reset token reuse blocked.

### Frontend helper behavior tests
- `ui/tests/authSmokeHelpers.test.mjs`
  - `resolvePostAuthNavigation` behavior:
    - firm user -> `/app/firm/:firmSlug/dashboard`
    - SuperAdmin -> `/app/superadmin`
    - invalid external `returnTo` ignored
    - cross-namespace `returnTo` ignored
    - valid same-namespace `returnTo` accepted
  - `resolveAuthRedirectDestination` + `isPublicAuth401Suppressed` behavior
  - `clearPendingLoginSessionState` + `clearSuperadminRoutingHints` storage cleanup behavior

## What is mocked/stubbed
- Backend smoke tests use in-memory model/session/cookie stubs (no Redis, DNS, email, DB dependency).
- Frontend helper behavior tests execute helper logic with deterministic injected dependencies and fake storage objects.

## Still manual/browser/deployment validation
- Real browser cookie policy behavior across domains (SameSite/Secure/CORS).
- Full-page route transitions and UX timing under real API latency.
- Live OTP delivery integration and external provider behavior.
