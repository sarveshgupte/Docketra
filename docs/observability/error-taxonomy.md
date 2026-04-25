# Operational error taxonomy

Updated: April 24, 2026.

## Core reason-code families

- `AUTH_*`: authentication/login/session state failures.
- `TENANT_*`: tenant scope, firm routing, or impersonation boundary failures.
- `UPLOAD_*`: document upload intent/finalize/provider issues.
- `REPORT_*`: reporting/export/query failures.
- `STORAGE_*`: BYOS storage connectivity/degraded-mode failures.
- `AUDIT_*`: audit write/sanitization/degraded persistence failures.

## Correlation and traceability requirements

Every operational error should be diagnosable with:

- `requestId` (backend-generated or propagated)
- `correlationId` (frontend workflow-level id)
- `route` + `method`
- `statusCode`
- optional `reasonCode`

No sensitive request payloads, token values, cookies, OTPs, passwords, reset links, or signed URLs may be included in error metadata.

## Safe vs unsafe diagnostic fields

### Safe
- request identifiers (`requestId`, `correlationId`)
- HTTP metadata (`route`, `method`, `statusCode`)
- firm/tenant id where authorized
- actor id (`userXID`) where authorized
- duration, pagination counts, boolean filter flags
- normalized error code (`reasonCode` / `errorCode`)

### Unsafe
- auth/session secrets (password, OTP, JWT, refresh/access tokens, cookies)
- raw search text, docket/client names, comments/descriptions
- email verification / password reset links
- attachment signed URLs and provider tokens
- raw stack traces in API responses or tenant-facing diagnostics

## Slow-endpoint reason-code conventions

Use endpoint-local reason codes where possible:

- `REPORT_QUERY_SLOW`
- `WORKLIST_QUERY_SLOW`
- `CASE_LIST_SLOW`
- `DASHBOARD_QUERY_SLOW`

All slow diagnostics must include only safe category flags (not raw query text/values).
