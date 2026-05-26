# Security Audit Report — May 2026

## Executive summary
A first-pass security review was completed across backend, frontend, route schemas, auth/session controls, tenant scoping patterns, uploads/storage, and logging/config surfaces. The codebase has several good foundations (schema validation coverage, tenant-scope helpers in many core flows, cookie-auth tests, CSRF middleware tests), but there are still material risks requiring phased remediation before beta.

### Severity overview
- **Critical:** 1
- **High:** 3
- **Medium:** 4
- **Low:** 2

## Findings

### Critical 1 — Public upload token endpoint can be abused for PIN/email spam and link probing
- **Evidence:** `src/controllers/uploadSession.controller.js` `requestUploadPin` and `getUploadMeta` query by `token` alone and are unauthenticated by design for public flow.
- **Why it matters:** Anyone with/guessing a valid token can trigger repeated PIN rotations/sends and probe valid/expired token states.
- **Exploit scenario:** Attacker scripts requests to `/upload/:token/request-pin` to spam client inboxes and degrade usability; token validity probing can help enumerate live upload sessions.
- **Recommended fix:** Add strict per-token + per-IP rate limiting and lockout windows; require proof-of-work/captcha on public PIN requests; make meta responses uniform to reduce oracle behavior.

### High 1 — Tenant isolation gap in duplicate detector fuzzy matching
- **Evidence:** `src/services/clientDuplicateDetector.js` performs `Client.find({ isActive: true })` without firm scoping.
- **Why it matters:** Cross-firm client metadata can influence duplicate matching logic and possibly leak correlations.
- **Exploit scenario:** User at Firm A triggers duplicate check and receives match signals derived from Firm B clients.
- **Recommended fix:** Add mandatory `firmId` scope to fuzzy match query and corresponding service API contract.

### High 2 — Storage worker reads CaseFile by ID before firm check
- **Evidence:** `src/workers/storage.worker.js` uses `CaseFile.findById(fileId)` before tenant safety assertion.
- **Why it matters:** A forged/poisoned queue payload could load cross-tenant metadata before scoped validation.
- **Exploit scenario:** If queue integrity is weakened, attacker-enqueued job could reference external `fileId` and cause unauthorized object processing attempts.
- **Recommended fix:** Replace initial lookup with `CaseFile.findOne({ _id: fileId, firmId })`; keep assertTenantSafety as defense-in-depth.

### High 3 — Error details reflected to client in download flow
- **Evidence:** `src/controllers/case.controller.js` returns `error: error.message` on download failure.
- **Why it matters:** Internal provider and storage errors can leak system details useful for targeted attacks.
- **Exploit scenario:** Trigger backend download failures to extract provider/file state hints.
- **Recommended fix:** Return generic user-safe message only; keep full details in redacted server logs.

### Medium 1 — Potential unsafe HTML in outbound email templates (future injection risk)
- **Evidence:** `src/controllers/uploadSession.controller.js` interpolates `uploadLink` in HTML email.
- **Why it matters:** If URL origins are ever misconfigured/untrusted, could produce malicious content in outbound messages.
- **Exploit scenario:** Mis-set `APP_URL` inserts phishing destination.
- **Recommended fix:** Validate `APP_URL` against allowlist and centralize safe template escaping.

### Medium 2 — Folder bootstrap path uses Firm.findById with possible ObjectId/string mismatch
- **Evidence:** `src/services/storage.service.js` calls `Firm.findById(firmId)` while many callsites use string tenant IDs.
- **Why it matters:** Mis-resolution can trigger fallback paths and inconsistent storage setup behavior.
- **Exploit scenario:** Operational misconfiguration leads to wrong storage root assumptions.
- **Recommended fix:** Normalize firm identifier type at service boundary and validate expected format.

### Medium 3 — Public upload endpoints need explicit anti-automation controls documented/enforced
- **Evidence:** public upload controller paths include token-only endpoints and no visible local anti-bot middleware in controller.
- **Why it matters:** Credential-stuffing style abuse, PIN brute force, and request flooding risks.
- **Exploit scenario:** Distributed bots spam upload/PIN endpoints.
- **Recommended fix:** Ensure middleware-level rate limiting + anomaly detection on all `/upload/:token*` routes.

### Medium 4 — Sensitive logging hygiene remains mixed outside core auth tests
- **Evidence:** pattern search found broad logging surfaces around storage/upload/auth paths; some secure redaction exists in tests/log events, but consistency is not guaranteed everywhere.
- **Why it matters:** latent risk of token/PII leakage during edge-case error handling.
- **Exploit scenario:** debug log accidentally persists token-like values.
- **Recommended fix:** enforce centralized logger scrubber for token/password/otp/hash/cookie patterns and add regression tests.

### Low 1 — Build warning indicates invalid utility token in UI styling
- **Evidence:** `npm --prefix ui run build` warning about invalid utility theme value.
- **Why it matters:** not a direct vulnerability, but suggests config drift and potential maintainability risk.
- **Recommended fix:** clean theme token configuration.

### Low 2 — npm audit blocked by registry policy in this environment
- **Evidence:** `npm audit --omit=dev` returned 403 from advisory endpoint.
- **Why it matters:** dependency CVE visibility incomplete in current run.
- **Recommended fix:** run audit in CI environment with registry advisory access and fail builds on critical advisories.

## Suggested PR order
1. **PR 1 (critical):** Public upload anti-abuse/rate-limits/oracle hardening.
2. **PR 2 (high):** Tenant scoping fix in duplicate detector; scoped worker lookup; remove error reflection.
3. **PR 3 (medium hardening):** logger scrubber, APP_URL allowlist validation, identifier normalization.
4. **PR 4 (tests/docs):** security regression coverage and operational runbooks.

## Tests to add
- Public upload token abuse tests: repeated `request-pin`, brute-force PIN attempts, and token-probing behavior.
- Tenant isolation tests for duplicate detector ensuring strict `firmId` query.
- Queue payload safety tests proving cross-tenant `fileId` is rejected before load.
- Error-handling tests ensuring client responses never include raw internal error details.
- Log redaction tests for `token`, `otp`, `password`, `cookie`, `hash` across controllers/services/workers.

