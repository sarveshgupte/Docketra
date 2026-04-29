# PR: Auth stabilization follow-up (default-client strictness, logging safety, cookie diagnostics)

## Scope actually implemented in this PR
This PR is a targeted auth hardening follow-up focused on default-client resolution safety, auth log sanitization in login flows, and cookie-domain warning behavior. It does **not** claim complete end-to-end route refactors beyond the items below.

## Implemented changes

1. **Tenant profile fail-closed when default-client context is unavailable**
   - Reverted prior warning-only behavior for default-client repair failure in `GET /api/auth/profile`.
   - Tenant profile now returns `503` with `code=DEFAULT_CLIENT_CONTEXT_UNAVAILABLE` when default client cannot be resolved/repaired.
   - This enforces mandatory tenant workspace context for downstream docket/client/task flows.

2. **Default-client root-cause guardrails (firm id normalization)**
   - Added normalization in `defaultClient.guard` so populated firm objects are reduced to a safe firm Mongo id string before `Client` queries/upserts.
   - Added validation to reject invalid serialized object values like `[object Object]`.
   - Added normalization in `defaultClient.service` before default-client ensure path.

3. **Auth logging hardening in login service**
   - Replaced raw `req` object logging with a safe request snapshot (`requestId`, method, path) in login service logs.
   - Kept OTP telemetry identifier masking (email/xID) from previous fix.

4. **Cookie-domain warnings de-noised**
   - Cookie-domain validation warnings are now memoized and emitted once per unique invalid configuration instead of repeating on every cookie option resolution.

5. **Docs updated with explicit behavior/limitations**
   - Documented mandatory `defaultClientId` behavior and fail-closed profile semantics.
   - Documented superadmin forgot-password limitation and canonical tenant redirect.
   - Added explicit post-debug step to disable `AUTH_DEBUG_DIAGNOSTICS`.

## Tests updated/run
- Added `tests/defaultClientGuardNormalization.test.js` regression for populated firm-doc normalization (`firm._id` extraction for default-client queries).
- Re-ran auth and client consistency regression tests:
  - `node tests/defaultClientGuardNormalization.test.js`
  - `node tests/authSession.cookieOptions.test.js`
  - `node tests/authLoginCookieFlow.test.js`
  - `node tests/authSessionCookieModel.test.js`
  - `node ui/tests/authCookieClientConsistency.test.mjs`
  - `node tests/authForgotPasswordFirmContext.test.js`

## Outstanding work (not claimed as complete in this PR)
- Full route-by-route auth audit/fix coverage for every listed flow (forgot-password deep scenarios, MFA variants, all frontend route guards) requires additional dedicated changesets and expanded integration test coverage.
