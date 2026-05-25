# AUTH Login Init Regression (May 2026)

## Production symptom
- Endpoint: `POST /api/auth/login/init`
- Tenant example: `firmSlug=gupte-opc`, `xID=X000001`
- Observed in Render logs:
  - `AUTH_LOGIN_USER_CANDIDATES` logged, then request fails with `AUTH_LOGIN_SERVICE_FAILED`
  - error message: `next is not a function`
  - HTTP status: `500`
- UI impact: `/gupte-opc/login` shows *"Sign in failed — Server is unavailable right now."*

## Root cause
`authLogin.service` called injected login helper functions assuming they are always pure service-style functions. In this regression path, at least one helper behaved like Express middleware and invoked `next()`. Since no callback was passed by the service, runtime threw `next is not a function`.

This mismatch happened in the login init chain after user candidate lookup and before OTP success response.

## Fix
- Added `invokeHelperWithNext(...)` in `src/services/authLogin.service.js`.
- All helper calls in login init flow now execute through this bridge:
  - `validateTenantUserPreconditions`
  - `handlePasswordVerification`
  - `handlePostPasswordChecks`
- The bridge supports both patterns safely:
  - pure async return values
  - middleware-style `next()` callbacks
- Error propagation is preserved (errors are not swallowed).

## Regression coverage
- Added `tests/authLoginInitNextRegression.test.js`:
  - exercises `createAuthLoginService` with middleware-style helper stubs that call `next()`
  - validates login init completes without `next is not a function`
  - validates success response path remains intact

## Tests run
- `node tests/authLoginInitNextRegression.test.js`
- `node tests/authLoginCookieFlow.test.js`
- `npm run test:auth-pilot-smoke` *(fails in existing unrelated forgot-password pilot stub wiring)*
- `npm run test:security:pure`
- `npm run lint`

## Deploy verification checklist
1. Deploy backend to production.
2. Hit `POST /api/auth/login/init` with valid tenant credentials (`firmSlug` + `xID` + `password`).
3. Confirm response is OTP challenge success (`200` + `otpRequired=true`) or controlled OTP throttle (`429`), never `500`.
4. Confirm Render logs no longer contain `next is not a function` for auth login flow.
5. Confirm invalid credentials still return controlled auth failures (`401`/`403`) rather than `500`.
6. Confirm OTP resend/verify endpoints still operate for same tenant scope.
7. Confirm security telemetry/audit entries still write for login failures/success.
