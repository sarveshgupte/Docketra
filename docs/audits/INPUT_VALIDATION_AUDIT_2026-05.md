# Input Validation Audit — 2026-05

## Coverage summary
- Route-schema contract check executed via `tests/routeValidationContract.test.js`.
- 46/46 Express route files with handlers are using `applyRouteValidation`.
- 1 legacy allowlisted non-route utility module: `routeGroups.js`.
- Missing schema keys: 0.
- Stale schema keys: 0.

## Route files audited
- All route files under `src/routes` were audited through contract test and schema grep review.

## Strict vs passthrough findings
- Current codebase still has many passthrough schemas, especially in legacy admin/docket/storage/superadmin surfaces.
- High-risk mutation passthrough endpoints hardened in this pass:
  - `POST /` (team create) now strict with explicit `managerId` allowance.
  - `PATCH /:id` (team update) now strict.
  - `POST /:id/assign-user` (team assign) now strict.
  - `POST /:clientId/cfs/comments` now strict.
  - `POST /resend-credentials` now strict.

## High-risk fixes made
- Unknown key rejection added for Team Management write APIs to block payload injection of tenant/actor/system fields.
- Auth resend credentials payload now rejects non-contract keys.
- Client CFS comment creation now rejects unknown keys.

## Remaining legacy exceptions
- Broad passthrough remains in multiple legacy modules (notably admin, docket, storage, case and select reporting/search endpoints).
- Recommended phased follow-up: convert mutation routes to strict route-by-route with UI/controller compatibility checks.

## Tests run
- `node tests/inputValidationHardening.schema.test.js`
- `node tests/routeValidationContract.test.js`

## Readiness score
- **8.2 / 10**
  - Strengths: complete route-schema contract coverage; no missing/stale route keys; targeted hardening on risky write endpoints.
  - Gaps: broad passthrough still present in legacy mutation areas and should be reduced incrementally.
