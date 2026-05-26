# Security Fix PR Plan — May 2026

## PR 1 — Critical fixes only
- Add robust rate limiting for all public upload token endpoints (`/upload/:token/meta`, `/upload/:token/request-pin`, `/upload/:token`).
- Add anti-enumeration response strategy (uniform timing/message envelope for invalid vs expired tokens where feasible).
- Add abuse telemetry counters and alert thresholds.

## PR 2 — High severity fixes
- Fix tenant scope bug in duplicate detector (`Client.find({ isActive: true })` -> firm-scoped query).
- Harden storage worker lookup to `findOne({_id:fileId, firmId})` before any record use.
- Remove internal error message reflection from file download error responses.

## PR 3 — Medium hardening
- Enforce strict config validation for public URL and security-sensitive env vars.
- Introduce centralized log scrubber middleware/util for token/OTP/password/hash/cookie patterns.
- Normalize firm identifier typing at storage boundary and add guardrails for ObjectId/string transitions.
- Confirm route-level middleware coverage for CSRF/CORS/rate limits across auth and upload surfaces.

## PR 4 — Tests/docs cleanup
- Add regression tests for upload token abuse controls and tenant-scoped duplicate detection.
- Add worker payload isolation tests.
- Add negative tests asserting no secret-bearing logs or API error payloads.
- Update security docs and on-call response playbook.
