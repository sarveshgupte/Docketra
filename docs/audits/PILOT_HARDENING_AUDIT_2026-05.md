# Pilot Hardening Audit — May 2026

## Audited Areas
- Backend route/schema parity and mount-order startup risk gate.
- Frontend MVP route shell/nav exposure and critical page dependency contract checks.
- Frontend API helper contract checks for MVP surfaces.
- Build/deploy readiness command sweep.

## Commands Run
- `npm run ci:backend:routes`
- `npm run validate:env:test`
- `npm run validate:env:production`
- `npm run ci:frontend:build`
- `npm --prefix ui run test:ci`
- `npm run test:pilot-hardening`

## Pass/Fail Table
| Command | Status | Notes |
|---|---|---|
| `npm run ci:backend:routes` | PASS | Route schema contract and mount-order contract pass. |
| `npm run validate:env:test` | PASS | Env contract passes for test profile. |
| `npm run validate:env:production` | PASS | Production env validator passes. |
| `npm run ci:frontend:build` | PASS | UI compiles and builds. |
| `npm --prefix ui run test:ci` | PASS | Existing UI CI test suite passes. |
| `npm run test:pilot-hardening` | PASS | New hardening checks pass. |

## Broken Pages Found
- No new pilot-blocking page compile/runtime contract failures detected by static hardening checks.
- Existing non-MVP pages (e.g., CRM/CMS/knowledge surfaces) remain in codebase but are blocked from MVP nav in `platformNavigation` and covered by nav guard checks.

## Backend Startup Risks Found
- No missing route schema imports on audited route families (`admin`, `client`, `case`, worklist/workbasket-family).
- Existing global route/schema contract remains green.

## Route/Schema Gaps Found
- None detected by current route/schema contract gates.

## Frontend/API Mismatches Found
- No MVP API helper usage of CRM/CMS endpoints detected in audited API helper modules.
- Client API helper path-family constraints pass (/admin, /clients, /cases).

## Security/Tenant Concerns Found
- No new critical tenant-boundary regression identified in this audit-only PR.
- Follow-up recommended: add dedicated tenant query-lint coverage for `firmId`/`ownershipFirmId` requirements in data-access paths.

## Prioritized Follow-up PRs
1. Add deeper automated backend/frontend path parity by parsing Express mount prefixes and generating a normalized route manifest.
2. Add focused runtime test for Team & Access degraded dependency behavior (users visible even when workbasket/stats requests fail).
3. Add explicit regression test for default firm client non-deactivation invariant.
4. Add permission-focused static tests for superadmin decrypted-data access boundaries.
