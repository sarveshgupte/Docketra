# Auth E2E Smoke Coverage

## Covered flows

### Backend smoke coverage
- `tests/authE2ESmoke.test.js`
  - Firm login boundary smoke:
    - login init returns OTP challenge (`otpRequired` + `loginToken`) for firm-scoped credentials.
    - login verify sets `accessToken` and `refreshToken` cookies.
  - SuperAdmin session boundary smoke:
    - `/superadmin/login` path via controller login with env-backed credentials.
    - cookies set on login.
    - `/auth/profile` returns superadmin identity.
    - `/auth/refresh` succeeds and sets updated cookies.
    - `/auth/logout` clears auth cookies.
- `tests/authForgotPasswordOtpReliability.test.js`
  - Firm-scoped forgot-password init/verify/reset.
  - Cross-tenant reset blocking.
  - Reset token non-reusability.
  - OTP/token expiry rejection.
- `tests/superadminSessionParity.test.js`
  - SuperAdmin profile and session parity (login/profile/refresh/logout cookie model).
- `tests/authSession.refreshAccessToken.test.js`
  - Refresh token rotation/reuse/invalid token protections (including 401 behavior).

### Frontend/unit smoke coverage
- `ui/tests/authSmokeHelpers.test.mjs`
  - `resolvePostAuthNavigation`:
    - firm user goes to `/app/firm/:firmSlug/dashboard`.
    - superadmin goes to `/app/superadmin`.
    - invalid `returnTo` ignored.
    - cross-namespace `returnTo` ignored.
  - auth redirect helper expectations:
    - firm protected route -> `/:firmSlug/login`.
    - superadmin protected route -> `/superadmin/login`.
    - public auth pages suppress hard redirects.
  - logout/session cleanup helpers:
    - pending login keys removed.
    - superadmin routing hints + impersonation state removed.

## Mocks/stubs used
- Backend tests stub data/model methods for deterministic auth/session behavior (no live DB).
- Cookie setting/clearing is asserted through in-memory response doubles.
- SuperAdmin smoke stubs refresh token model persistence for rotation behavior checks.
- Frontend helper tests use in-memory storage doubles (`removeItem` collectors).

## Still requiring browser/manual testing
- Full browser redirect timing and UX states around async 401 handling.
- Real cookie behavior across domains/samesite/secure flags in deployed environments.
- OTP delivery channel integration (email/SMS provider) and inbox latency.
- Multi-tab logout broadcast behavior under real browser storage events.
