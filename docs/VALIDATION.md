# Validation Rules

Docketra enforces **strict validation on every API route**. No request reaches a controller without passing schema validation.

---

## Architecture

Validation is applied by `applyRouteValidation` in `src/middleware/requestValidation.middleware.js`.

Each route file calls `applyRouteValidation(router, routeSchemas)` which wraps every `router.get/post/put/patch/delete` call with a `validateRequest(schema)` middleware.

```
Request → validateRequest(schema) → controller
```

---

## Validation Rules

| Rule | Behaviour |
|---|---|
| Schema missing for a route | **Server throws at startup** – route registration fails immediately |
| Schema file missing for a route file | **Server throws at startup** – coverage check fails |
| Invalid input (body / params / query) | Returns `400 VALIDATION_ERROR` with structured error details |
| Dangerous keys (`__proto__`, `$…`, keys with `.`) | Silently stripped by `sanitizeInput` before schema validation |

---

## Schema Files

Each route file in `src/routes/` must have a corresponding schema file in `src/schemas/` with the naming convention:

```
src/routes/<name>.routes.js  →  src/schemas/<name>.routes.schema.js
```

### Schema File Structure

```js
const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  // Key format: '<METHOD> <path>'
  'POST /': {
    body: z.object({ name: nonEmptyString }).strict(),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
    query: z.object({}).passthrough(),
  },
};
```

Each key is `METHOD PATH` (e.g., `'GET /'`, `'POST /:id/action'`).

Each value is an object with optional `body`, `params`, and `query` Zod schemas.

---

## Common Schema Helpers (`src/schemas/common.js`)

| Export | Description |
|---|---|
| `z` | Zod instance |
| `nonEmptyString` | Trimmed string with min length 1 |
| `xidString` | Staff XID format: `X123456` |
| `clientIdString` | Client ID format: `C123456` |
| `caseIdString` | Case ID (Mongo ObjectId or CASE-YYYYMMDD-NNNNN) |
| `objectIdString` | 24-char hex Mongo ObjectId |
| `queryBoolean` | Accepts `"true"/"false"/"1"/"0"/"yes"/"no"` |
| `slugString` | Lowercase alphanumeric with hyphens |

---

## Adding a New Route

1. **Create route file**: `src/routes/<name>.routes.js`
2. **Create schema file**: `src/schemas/<name>.routes.schema.js`
3. **Wire up validation** in the route file:

```js
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/<name>.routes.schema');

const router = applyRouteValidation(express.Router(), routeSchemas);
```

4. **Add a schema entry for every route** registered via `router.get/post/put/patch/delete`.

   If a schema entry is missing, the server **will throw** when the route file is loaded.

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "location": "body",
        "path": "email",
        "code": "invalid_string",
        "message": "Invalid email"
      }
    ]
  }
}
```

---

## Constraints

- **Silent fallback is forbidden**: Missing schemas always throw, never silently pass.
- **Strict mode**: Use `.strict()` on schemas where extra keys must be rejected.
- **Passthrough mode**: Use `.passthrough()` only when additional keys are explicitly allowed.
- **No direct `express.Router()` without validation**: Always use `applyRouteValidation`.


### Startup Safety Note

When a route file uses `applyRouteValidation`, every declared `router.get/post/put/patch/delete` route **must** have a matching `'<METHOD> <path>'` schema key in the corresponding `src/schemas/*.routes.schema.js` file.

If even one key is missing (for example `GET /folder-link` in storage routes), backend startup fails immediately with a `Missing schema for route` error.

### CI deploy-safety gate

Backend deploy safety is CI-blocking through `npm run ci:backend:deploy-safety`, which runs:

- `validate:env:production` and `validate:env:test` (startup env validation)
- `tests/routeValidationContract.test.js` (route/schema parity)
- `tests/backendRuntimeEntrypoints.smoke.test.js` (production-mode backend startup smoke)

This gate is designed to fail before merge if route validation contract drift or runtime startup crashes would break a Render deployment.


## May 2026 input-hardening update

- Completed a repo-wide route/schema parity audit using `tests/routeValidationContract.test.js`.
- Hardened high-risk mutation schemas to reject unknown keys:
  - `src/schemas/team.routes.schema.js`: strict write payloads with explicit `managerId` support for create.
  - `src/schemas/client.routes.schema.js`: strict comment-create payload for CFS comments.
  - `src/schemas/auth.routes.schema.js`: strict resend-credentials payload.
- Added regression test coverage in `tests/inputValidationHardening.schema.test.js` to ensure these endpoints reject unsafe extra keys.
- Legacy passthrough usage still exists in several older modules and should be migrated in phased PRs with compatibility checks.
