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
- High-risk mutation passthrough endpoints hardened in this pass (GET/list query hardening is intentionally out-of-scope here):
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
- Recommended phased follow-up: (1) continue mutation-route strictness migration with compatibility checks, then (2) audit and bound list/search/report query schemas route-by-route to avoid breaking consumers.

## Tests run
- `node tests/inputValidationHardening.schema.test.js`
- `node tests/routeValidationContract.test.js`

## Readiness score
- **8.2 / 10**
  - Strengths: complete route-schema contract coverage; no missing/stale route keys; targeted hardening on risky write endpoints.
  - Gaps: broad passthrough remains in legacy mutation areas, and list/search/report query schemas are still a phased follow-up rather than fully hardened.

## PR 2 — mutation strictness hardening (legacy passthrough migration)

### Mutation endpoints converted to strict mode in this pass
- `src/schemas/admin.routes.schema.js`
  - `PATCH /clients/:clientId/status`
  - `POST /clients/:clientId/change-name`
  - `PATCH /users/:id/hierarchy`
  - `PUT /firm-settings`
  - `PUT /cms-intake-settings`
  - `POST /cms-intake-settings/intake-api-key/regenerate`
  - `POST /users/:id/restore`
  - `POST /cases/:id/restore`
  - `PUT /storage`
  - `POST /storage/disconnect`
  - `POST /clients/:id/restore`
  - `POST /tasks/:id/restore`
- `src/schemas/client.routes.schema.js`
  - `PUT /:clientId/fact-sheet`
  - `POST /:clientId/fact-sheet/files`
  - `POST /:clientId/cfs/files`
- `src/schemas/storage.routes.schema.js`
  - `POST /google/confirm-drive`
  - `POST /test-connection`
  - `POST /disconnect`

### Remaining passthrough exceptions (intentional, temporary)
- Legacy admin/client create-update fact sheet and other older mutation surfaces that still accept dynamic document payloads are retained only where contract uncertainty remains and require controller/UI payload inventory before tightening.
- GET/list/search/report query schemas remain broadly passthrough by design in this PR to avoid backward-compatibility regressions.

### Tests run
- `node tests/inputValidationHardening.schema.test.js`
- `node tests/inputValidationMutationStrictness.test.js`
- `node tests/routeValidationContract.test.js`

### Follow-up list (queries/list/report)
- Route-by-route query hardening for list/search/report endpoints in admin, client, case, docket, reports, and storage modules.
- Replace query passthrough with bounded, explicit keys + coercion constraints after consumer inventory.
