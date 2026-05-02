# AUTH E2E SMOKE COVERAGE (Pilot Readiness)

## Scope
Deterministic auth/session smoke coverage for pilot-critical flows:
- Tenant login/init + OTP verify (success + invalid OTP)
- Forgot-password init/verify/reset (including invalid/expired and tenant boundary checks)
- SuperAdmin auth route boundary separation
- Frontend public auth routing + post-login redirect sanity

## Commands Run
- `node tests/authPilotReadinessSmoke.test.js`
- `npm run test:auth-pilot-smoke`
- `npm --prefix ui run test:public-auth-routing-sanity`

## Flow Coverage
### Backend tenant auth smoke
- login/init challenge response
- OTP verify success
- OTP verify invalid failure
- forgot-password init + verify

### Backend forgot-password reliability
- request/init by email and xID
- verify with valid OTP
- invalid OTP, expired OTP, expired reset token rejection
- reset token one-time use and tenant-context boundary checks

### SuperAdmin/tenant boundary
- `/api/superadmin/*` remains isolated from tenant resolver and firm router
- `/api/auth/*` remains outside tenant-resolved firm routes
- SuperAdmin login/profile routes exist and return auth semantics (not route misses)

### Frontend auth route/helper sanity
- public auth route classification
- redirect behavior and post-login resolution
- protected/public boundary regression

## Pass/Fail Status (current run)
- `node tests/authPilotReadinessSmoke.test.js`: **PASS**
- `npm --prefix ui run test:public-auth-routing-sanity`: **PASS**
- `npm run test:auth-pilot-smoke`: **FAIL** (currently failing on SuperAdmin session parity path due environment-coupled auth audit DB buffering in this container run)

## Bugs Found
- The previous smoke harness used request shapes that did not match auth service expectations (`xID` vs `identifier`), causing false failures.
- SuperAdmin session-parity command path still has deterministic-run coupling to DB-backed audit buffering in this environment.

## Fixes Made
- Fixed tenant auth smoke request payloads so login/init and OTP verify execute actual service logic.
- Added deterministic bcrypt-stubbed SuperAdmin pilot session smoke harness (`tests/superadminPilotSessionSmoke.test.js`) to reduce native dependency flake.
- Kept existing boundary regression coverage for SuperAdmin vs firm route isolation.

## Remaining to reach full pilot-ready acceptance
- Make `npm run test:auth-pilot-smoke` fully green by removing remaining DB-coupled behavior from the SuperAdmin session path in deterministic test mode.
- Then re-run and record final PASS for auth pilot smoke + release-gate/fallback.
