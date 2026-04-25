# Superadmin support diagnostics

## Purpose

`/app/superadmin/diagnostics` gives superadmin a privacy-safe support console for pilot triage.

It is designed to answer:
- is a firm active/suspended?
- is onboarding blocked or stale?
- is storage configured and healthy?
- are there recent login/OTP issues?
- are API errors rising, and in what category?
- which request IDs should support use to trace incidents?

## Endpoint and access

- UI route: `/app/superadmin/diagnostics`
- API route: `GET /api/superadmin/diagnostics`
- Access: **superadmin only** (`requireSuperadmin` enforced in backend route).

## What superadmin can view

Redacted operational summaries only:
- firm identity and lifecycle status (`firmId`, name, status)
- onboarding summary counters (incomplete users, stale users, blocker type codes, next action)
- storage mode/provider + storage health status (no credentials)
- recent auth failure events with:
  - timestamp
  - action type
  - normalized reason code
  - request ID (when available)
- API error totals grouped by coarse category (`auth`, `client`, `server`, `rate_limit`, etc.)
- slow endpoint percentile summary (`p50`, `p95`, sample count)
- support tracing request IDs list

## What superadmin cannot view

The diagnostics surface intentionally excludes:
- client records and document contents
- attachment payloads or extracted text
- user secrets (passwords, tokens, OTP values)
- raw request/response bodies
- BYOS provider secrets/credentials
- full per-user PII payloads

## Redaction and privacy controls

- Login/OTP issues are surfaced as reason-code summaries, not raw metadata payloads.
- Request tracing uses request IDs only.
- Storage diagnostics include status/health only.
- API errors are grouped by category to reduce leakage of path/payload detail.

## Support playbook (high-level)

1. Open Diagnostics and filter latest issues.
2. Confirm firm lifecycle + onboarding next action.
3. Verify storage mode and health status.
4. Check login/OTP failures and capture request IDs.
5. Correlate request IDs in backend logs/audits for deeper investigation.
6. If tenant data inspection is needed, coordinate with firm admin through approved operational runbooks (superadmin does not access client content directly).
