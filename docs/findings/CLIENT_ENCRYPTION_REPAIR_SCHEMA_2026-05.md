# Client Encryption Repair Schema Fix (May 2026)

## Symptom
- Render backend crashed during startup with:
  - `Error: [Validation] Missing schema for route: POST /encryption/repair.`
- Crash surfaced when `client.routes.js` was registered through `applyRouteValidation`.

## Root Cause
- Route `POST /encryption/repair` existed in `src/routes/client.routes.js`.
- No matching schema key was present in `src/schemas/client.routes.schema.js`.
- Request-validation middleware enforces explicit schema coverage for every registered route.

## Fix
- Added explicit schema entry for `POST /encryption/repair` in `src/schemas/client.routes.schema.js`.
- Enforced strict payload boundaries:
  - `body` must be an empty object only.
  - `query` must be an empty object only.
  - Unknown fields are rejected.
- Added regression test `tests/clientEncryptionRepairRouteSchema.test.js` validating:
  - schema key exists,
  - empty body/query pass,
  - unexpected body fields are rejected,
  - unexpected query fields are rejected.

## Deploy Verification
1. `node -e "require('./src/app/createApp')"` completes without missing-schema startup errors.
2. `POST /clients/encryption/repair` with `{}` body validates and proceeds to authorization/controller.
3. `POST /clients/encryption/repair` with any body keys (e.g., `firmId`, `tenantId`, `keyMaterial`) returns `400 VALIDATION_ERROR`.
4. `POST /clients/encryption/repair?tenantId=...` returns `400 VALIDATION_ERROR`.
