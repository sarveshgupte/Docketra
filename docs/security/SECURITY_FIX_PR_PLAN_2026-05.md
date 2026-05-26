# Security Fix PR Plan — May 2026

## PR 1 — Confirmed high-risk fixes only
1. Add explicit rate-limiter coverage for `GET /upload/:token/meta` to align with existing upload-token POST protections.
2. Fix tenant scoping in duplicate detector fuzzy path (`Client.find({ isActive: true })` -> include `firmId`).
3. Remove internal error detail reflection (`error.message`) from download failure API responses.

## PR 2 — Verification-first for partially confirmed high-risk item
1. Verify queue trust boundary:
   - enumerate queue writers
   - validate producer auth/ACL assumptions
   - document whether untrusted enqueue is possible
2. If trust boundary is not airtight (or as defense-in-depth regardless), scope worker first read to `CaseFile.findOne({ _id:fileId, firmId })` before processing.
3. Add tests for mismatched `firmId/fileId` queue payload handling.

## PR 3 — Medium hardening
1. Add strict env validation/allowlist for `APP_URL` and other external-link origins.
2. Normalize firm identifier types at storage service boundaries.
3. Introduce centralized log scrubber utility + policy for token/otp/password/hash/cookie-like values.

## PR 4 — Tests/docs cleanup
1. Add route-level limiter regression tests for all `/upload/:token*` endpoints.
2. Add tenant isolation regression tests for duplicate detection.
3. Add API error payload sanitization tests and logging redaction tests.
4. Update security docs/runbooks and beta release gate checklist (including mandatory dependency CVE audit in CI).
