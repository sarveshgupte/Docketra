# Backend Route Validation Contract

## Purpose
Docketra enforces a **phased** backend route-validation contract so validation can be tightened safely without breaking legacy paths during migration.

## Current enforcement model (phased)
1. Routes that already use `applyRouteValidation(express.Router(), routeSchemas)` are **strictly enforced**.
2. Strict enforcement means all of the following fail CI:
   - missing schema key for a declared route,
   - stale schema key with no matching route,
   - invalid schema key format (must be `'<METHOD> /path'`).
3. Route files that do **not** use `applyRouteValidation` must be explicitly listed in the legacy allowlist in `tests/routeValidationContract.test.js` with a clear migration reason.
4. Unknown non-validated route files fail CI until they are either:
   - migrated to Zod + `applyRouteValidation`, or
   - intentionally allowlisted with a TODO/migration reason.

## Route schema conventions
- Validation schemas are Zod-based route maps under `src/schemas/*.routes.schema.js`.
- Key format must be exact: `'<METHOD> <path>'` (example: `'POST /forms/:id/submit'`).
- Schema keys must match declared `router.get/post/put/patch/delete` route paths exactly.

## Public intake safety
- Public intake uses validated endpoint: `POST /api/public/cms/:firmSlug/intake`.
- Tenant context (`firmId`) is resolved from `:firmSlug` server-side.
- Caller-provided tenant hints (for example `firmId`, `clientId`) must not control tenant resolution.
- Malformed payloads are rejected by route-level Zod validation.
- Legacy endpoint `POST /api/cms/submit` stays deprecated and returns `410 ROUTE_DEPRECATED`.

## Enforcement command
```bash
node tests/routeValidationContract.test.js
```

The command prints a summary of:
- validated route files,
- legacy allowlisted route files,
- failure counts (missing/stale/format/non-allowlisted).

## Adding or updating routes
1. Prefer adding routes with `applyRouteValidation` from the start.
2. Add matching Zod entries in `src/schemas/<name>.routes.schema.js`.
3. If migration cannot be completed in the same PR, add explicit allowlist entry with reason and TODO.
4. Run route-contract and route-specific tests before merge.
