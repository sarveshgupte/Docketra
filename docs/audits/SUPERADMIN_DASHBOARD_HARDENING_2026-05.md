# SuperAdmin Dashboard Hardening Audit (May 2026)

## Files audited
- `ui/src/components/auth/ProtectedRoute.jsx`
- `ui/src/components/common/SuperAdminLayout.jsx`
- `ui/src/pages/SuperadminDashboard.jsx`
- `src/routes/superadmin.routes.js`
- `src/controllers/superadmin.controller.js`
- `src/schemas/superadmin.routes.schema.js`
- `ui/tests/superadminGlobalSearchSource.test.mjs`

## Bugs found
1. SuperAdmin sidebar active-state logic only matched exact path and did not stay active on nested routes.
2. Global search sent network requests for 1-character queries and relied on manual Enter/click without debounce.
3. SuperAdmin mutation schemas used permissive `.passthrough()` in multiple write endpoints, allowing unexpected request fields.
4. SuperAdmin search tiny-input state was not explicit, which could appear inconsistent to operators.

## Fixes applied
- Updated SuperAdmin nav active-state matching to support nested path prefixes.
- Added debounced (300ms) global search execution for non-trivial input.
- Added minimum query-length guard (`>=2`) before issuing superadmin search API calls.
- Added explicit tiny-input helper state (“Enter at least 2 characters.”).
- Tightened SuperAdmin route validation schemas for write routes and sensitive query routes by switching to `.strict()` where appropriate.
- Kept read-only/query passthrough only where operationally intended (`GET` endpoints that allow ad-hoc filters already handled safely downstream).
- Expanded source-level regression checks for global-search accessibility label, debounce, and tiny-input guardrails.

## Routes verified
- `/app/superadmin/*` UI routes remain protected with `requireSuperadmin`.
- Firm workspace routes redirect SuperAdmin users away from `/app/firm/:firmSlug/*`.
- Backend superadmin routes remain hard fail-closed via `router.use(requireSuperadmin)` and policy authorization.

## Tests added/updated
- Updated `ui/tests/superadminGlobalSearchSource.test.mjs` with assertions for:
  - accessible search label
  - debounce behavior presence
  - tiny-input request guard
  - safe tiny-input empty helper messaging

## Remaining known limitations
- Full E2E integration coverage for every SuperAdmin child page loading/error fallback remains distributed across existing route/page tests rather than a single consolidated suite.
- Some legacy non-superadmin schemas still use `.passthrough()` outside SuperAdmin scope and should be audited separately.

## Readiness score
**8.6 / 10** for SuperAdmin dashboard hardening for private pilot.

Rationale: route boundaries and schema strictness are materially improved; search safety/UX guardrails are stronger; broader cross-module schema hardening and full-page E2E exhaustiveness can still improve confidence further.
