# Firm Signup / Create Workspace Hardening Audit (May 2026)

## Routes audited
- Frontend: `/`, `/signup`, `/find-workspace`, `/:firmSlug/login`, `/app/firm/:firmSlug/dashboard`
- Backend: `/api/public/initiate-signup`, `/api/public/verify-otp`, `/api/public/resend-otp`, `/api/public/complete-signup`, `/api/auth/find-workspace`

## Files changed
- `src/middleware/firmSlugGuard.middleware.js`
- `src/services/signup.service.js`
- `ui/src/pages/marketing/Signup.jsx`
- `tests/signupReservedSlugGuard.test.js`
- `tests/publicSignupReservedSlugFallback.test.js`
- `tests/signupPageAuthenticatedRedirect.ui.test.js`
- `docs/whats-new.md`

## Bugs found
1. `api` namespace was not in reserved firm slugs, allowing risky firm-slug takeover attempts.
2. Signup slug generation did not explicitly guard reserved slug candidates before uniqueness iteration.
3. Authenticated users could still load `/signup` instead of being safely redirected into workspace/login routing.

## Fixes applied
1. Added `api` to reserved firm slug blocklist.
2. Hardened signup slug generator to rewrite reserved slug candidates to `-workspace` before collision checks.
3. Added authenticated-user guard in signup page:
   - if auth + `firmSlug` → redirect to canonical dashboard route.
   - if auth without slug → redirect to `/find-workspace`.

## Tests added
- Reserved slug guard coverage for `auth`, `api`, and `superadmin`.
- Signup service source-level guard assertion for reserved-slug fallback behavior.
- UI guard assertion for authenticated `/signup` redirects.

## Commands run
- `node tests/signupReservedSlugGuard.test.js`
- `node tests/publicSignupReservedSlugFallback.test.js`
- `node tests/signupPageAuthenticatedRedirect.ui.test.js`

## Remaining limitations
- Public self-serve signup still uses firm name (not user-entered slug), so explicit custom-slug UX validation is not in this flow.
- Failure-path behavior for deeper default initialization remains dependent on existing transactional + setup service guarantees already in place.

## Readiness score
**8.6 / 10** for private-pilot signup hardening in audited scope.
