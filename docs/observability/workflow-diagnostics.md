# Workflow diagnostics

Updated: April 24, 2026.

## Request/correlation ID behavior

- Frontend creates `X-Correlation-ID` per API workflow (`ui/src/services/api.js`).
- Backend guarantees `requestId` and emits both `X-Request-ID` and `X-Correlation-ID` (`src/middleware/requestId.middleware.js`).
- Backend lifecycle and error diagnostics now include both identifiers (`src/middleware/requestLifecycle.middleware.js`, `src/utils/log.js`).
- Frontend API diagnostics capture backend `x-request-id` from responses/errors to bridge browser + backend traces.

## Standard slow-endpoint log shape

Slow events:

- `[CASE_LIST_SLOW]`
- `[WORKLIST_QUERY_SLOW]`
- `[DASHBOARD_QUERY_SLOW]`
- `[REPORT_QUERY_SLOW]`

Canonical fields:

- `marker`, `diagnosticType`
- `requestId`, `correlationId`
- `route`, `method`
- `durationMs`, `thresholdMs`
- `firmId`, `userXID` (when tenant-safe)
- `queryCategoryFlags` (booleans/category tags only)
- `pagination` (`page`, `limit`)

Raw search terms, names, comments, tokens, reset links, and attachment metadata are prohibited.

## Frontend diagnostics hygiene

- Diagnostics are emitted through workflow diagnostics helpers.
- Console output is dev-only via safe console guard (`ui/src/utils/safeConsole.js`).
- Production suppresses direct console dumping to avoid accidental payload leakage.
- Duplicate request and route-transition diagnostics remain available as safe metadata-only events.

## Audit event hygiene

Audit metadata must be normalized and sanitized to safe fields only:

- action type
- actor (`performedBy`, `userXID`)
- target id / list marker
- tenant/firm id
- result/status/reason code
- safe booleans/counts

Do not store request bodies, secrets, full blobs, signed URLs, or raw stack traces.

## Manual QA checklist

1. Confirm login/logout/forgot-password still work.
2. Confirm create/open/update docket workflows still work.
3. Confirm upload + BYOS Google Drive flows still work.
4. Trigger backend validation error and verify user-safe response.
5. Trigger slow list/report endpoint and verify standardized slow log payload.
6. Trigger failed auth and verify no password/OTP/token/reset-link in logs.
7. Check prod build browser console for absence of raw API payload logs.
8. Verify audit metadata contains only safe normalized fields.
9. Verify request IDs are visible in response headers and diagnostics.

## Follow-up items

- Add dashboard/service-level propagation of `correlationId` where service calls are detached from `req`.
- Add tenant-safe diagnostics API contract tests for superadmin/operator views.
- Add CI guard to fail on new unsafe console/debug patterns in `ui/src` and `src`.
