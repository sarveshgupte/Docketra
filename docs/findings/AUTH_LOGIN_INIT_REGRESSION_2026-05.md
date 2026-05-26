# AUTH Login Init Regression (May 2026)

## Production symptom
- Endpoint: `POST /api/auth/login/init`
- Tenant example: `firmSlug=gupte-opc`, `xID=X000001`
- Observed in Render logs:
  - `AUTH_LOGIN_USER_CANDIDATES` logged, then request fails with `AUTH_LOGIN_SERVICE_FAILED`
  - error message: `next is not a function`
  - HTTP status: `500`
- UI impact: `/gupte-opc/login` shows *"Sign in failed — Server is unavailable right now."*

## Root cause status
Confirmed from production Render stack trace: `User.model.js` query middleware for hierarchy update validation used callback-style `next` in `pre('findOneAndUpdate')` / `pre('updateMany')`. During login-init failed-password accounting (`handlePasswordVerification` path), Mongoose executed the hook without a callback and the hook's `next()` call threw `TypeError: next is not a function`.

## Fix
- Converted User query pre-hooks used by hierarchy update validation to promise/sync style (no `next` parameter):
  - `pre('findOneAndUpdate')`
  - `pre('updateMany')`
  Each hook now calls `assertHierarchyUpdatePayload(this.getUpdate() || {})` directly so thrown validation errors propagate naturally without callback assumptions.
- Added temporary production-safe diagnostics on `AUTH_LOGIN_SERVICE_FAILED` to log:
  - `checkpoint` (which helper was executing),
  - `error.message`,
  - `error.stack`.
  This logging intentionally excludes password, OTP, passwordHash, cookies, tokens, and secrets.

## Regression coverage
- Added `tests/authLoginInitNextRegression.test.js`:
  - exercises `createAuthLoginService` login-init chain with middleware-style helper stubs that call `next()`
  - validates login init success path reaches OTP challenge without `next is not a function`
  - validates invalid credentials path returns controlled `401` (not `500`)
  - validates `next(error)` path is propagated safely as controlled service failure (`500` with `AUTH_LOGIN_FAILED`)
  - validates middleware-style `handlePasswordVerification` and `handlePostPasswordChecks` do not crash and still reach OTP challenge

## Tests run
- `node tests/authLoginInitNextRegression.test.js`
- `node tests/authLoginCookieFlow.test.js`
- `npm run test:auth-pilot-smoke`
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
