# PR note: Log redaction, audit hygiene, and production diagnostics (April 2026)

## Scope

This change hardens observability across backend + frontend for pilot readiness, with focus on:

- centralized sensitive data redaction
- request/correlation traceability
- standardized slow endpoint diagnostics
- audit metadata hygiene
- frontend production logging safety

## Redaction policy

Central helper: `src/utils/redaction.js`

Redacts:

- password/OTP/reset/verification secrets
- JWT/access/refresh/session tokens
- authorization/cookie/API key values
- OAuth/Google/BYOS tokens
- PAN/Aadhaar-like values
- signed/attachment URLs and sensitive query params
- comment/description/client-sensitive metadata keys

Consumers updated:

- `src/utils/getFieldChanges.js`
- `src/services/audit.service.js`
- `src/services/securityAudit.service.js`
- `src/services/auditLog.service.js`
- `src/utils/log.js` (structured logs include correlation id + masked payload)

## Safe vs unsafe diagnostics fields

### Safe
- request/correlation ids
- method/route/status
- duration + thresholds
- tenant-safe actor/firm ids
- boolean category flags and pagination counts

### Unsafe
- payload bodies and raw search strings
- tokens/cookies/passwords/OTP/reset links
- attachment signed URLs
- client/docket narrative fields (comments/descriptions)
- raw stack traces in tenant-facing contexts

## Request correlation behavior

- Backend always sets `requestId` and `correlationId` headers.
- Lifecycle + slow logs include request id and correlation id where available.
- Frontend API diagnostics now capture backend `x-request-id` for successful/failed responses.

## Slow endpoint shape

Standardized via `src/utils/slowLog.js` for:

- `[CASE_LIST_SLOW]`
- `[WORKLIST_QUERY_SLOW]`
- `[DASHBOARD_QUERY_SLOW]`
- `[REPORT_QUERY_SLOW]`

Fields:

- marker, requestId, correlationId, route/method
- durationMs, thresholdMs
- firmId/userXID (when safe)
- queryCategoryFlags (no raw values)
- pagination metadata

## Audit hygiene rules

Audit writes preserve visibility while sanitizing metadata:

- keep action/actor/target/tenant/result context
- remove or redact secrets and high-risk payload content
- avoid embedding request bodies and stack traces

## Frontend production diagnostics safety

- Added `ui/src/utils/safeConsole.js`.
- Production console methods are guarded to prevent payload leakage.
- Development console output remains available with basic redaction.
- Workflow diagnostics continue to emit structured events for tooling.

## Automated tests added/updated

- `tests/logRedaction.test.js`
  - validates redaction of tokens/secrets/links and audit-like metadata
- `tests/debugMarkerScan.test.js`
  - blocks known debug markers (`DOCKET_DEBUG`, `ACTION_VISIBILITY_DEBUG`, raw `console.log('API response'...)`)
- `tests/requestId.middleware.test.js`
  - now validates correlation-id propagation and response headers

## Manual QA checklist

1. Login/logout/forgot-password still work.
2. Create/open/update docket still work.
3. Upload attachment/document request still works.
4. BYOS Google Drive connect still works.
5. Backend validation errors remain user-safe.
6. Slow list/report endpoints emit structured redacted slow logs.
7. Failed auth attempts do not log password/OTP/token/reset links.
8. Production build browser console has no raw API/debug payload dumping.
9. Audit metadata excludes sensitive payloads.
10. Request ID appears in response headers and correlated diagnostics.

## Follow-up items

- Expand route-level tests for standardized slow-log contract across all modules.
- Add explicit tenant-safe diagnostics response contract tests for superadmin/operator tools.
- Add CI lint rule for unsafe `console.*` usage outside approved wrappers.
