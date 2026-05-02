# AUTH E2E SMOKE COVERAGE (Pilot Readiness)

## Scope
Deterministic auth/session smoke coverage for pilot-critical flows only:
- Tenant login init + OTP verify (success and invalid OTP failure)
- Forgot-password OTP + reset token flow and tenant context checks
- SuperAdmin login/profile/refresh/logout parity
- Firm and SuperAdmin route boundary regression
- Frontend public auth routing and post-login redirect helpers

## Commands Run
- `node tests/authPilotReadinessSmoke.test.js`
- `npm run test:auth-pilot-smoke`
- `npm --prefix ui run test:public-auth-routing-sanity`

## Flow Coverage
### Backend tenant auth smoke
- login/init returns OTP challenge (`202`)
- OTP verify success returns session payload (`200`)
- invalid OTP rejects (`401`)
- forgot-password init/verify/reset and invalid/expired states
- tenant context preserved by `firmSlug`/`firmId` checks

### SuperAdmin auth smoke
- SuperAdmin login, profile, refresh, logout lifecycle
- normal firm user blocked from SuperAdmin-only boundaries (existing regression test)

### Frontend auth route/helper smoke
- public auth route classification and redirect behavior
- post-login route resolution
- protected route/public boundary sanity
- refresh loop prevention covered by existing frontend auth route tests in CI suite

## Bugs Found
- Historical regression context tracked: tenant OTP verify `401` in prior smoke PR.
- No new production auth/session bug reproduced during this pass in deterministic harnesses.

## Fixes Made
- Added deterministic pilot-auth smoke harness test to pin tenant OTP login/verify and forgot-password baseline paths.
- Added backend script target `test:auth-pilot-smoke` for repeatable pilot auth validation.

## Pass/Fail Status
- `authPilotReadinessSmoke.test.js`: BLOCKED (environment dependency install restriction)
- `test:auth-pilot-smoke`: BLOCKED (environment dependency install restriction) (local deterministic suite)
- `ui test:public-auth-routing-sanity`: BLOCKED (environment dependency install restriction)

## Remaining Manual Browser Checks
- Manual browser validation for cookie persistence and redirects across real browser restarts.
- Manual validation of logout and refresh under real reverse proxy / HTTPS cookie policies.
- Final pilot manual QA checklist PR should include tenant-specific browser matrix verification.

## Pilot QA Readiness
Auth smoke coverage is deterministic and suitable to unblock the final pilot manual QA checklist PR, subject to remaining manual browser checks above.
