# Security Audit Report — May 2026

## Executive summary
This audit reviewed backend/frontend security controls with emphasis on auth/session security, tenant isolation, RBAC, uploads/storage, and logging/config. Findings below now distinguish **confirmed issues** from **likely risk** and **verification-required** items.

### Severity overview (updated)
- **Critical:** 0
- **High:** 3
- **Medium:** 4
- **Low:** 2

> Note: the previous “public upload token abuse” item has been downgraded from Critical after confirming route-level throttling exists on high-risk upload POST routes.

## Findings

### High 1 — Public upload token routes have partial anti-abuse coverage; metadata endpoint lacks explicit limiter
- **Evidence confidence:** **Confirmed**
- **Evidence:**
  - `POST /upload/:token` and `POST /upload/:token/request-pin` are protected by `publicUploadLimiter`. (`src/routes/public.routes.js`)
  - `GET /upload/:token/meta` currently has no explicit limiter in route definition. (`src/routes/public.routes.js`)
  - `publicUploadLimiter` is an IP-keyed limiter backed by configured rate limits. (`src/middleware/rateLimiters.js`)
- **Why it matters:** Public token endpoints are unauthenticated by design; uneven throttle coverage can still allow token-probing pressure and high-volume metadata enumeration.
- **Exploit scenario:** Attacker runs high-frequency `GET /upload/:token/meta` probing to enumerate valid/expired tokens while respecting POST throttle limits.
- **Recommended fix:** Add dedicated limiter for `/upload/:token/meta` (or apply `publicUploadLimiter` consistently to all `/upload/:token*` routes), plus response-shape hardening to reduce oracle behavior.

### High 2 — Tenant isolation gap in duplicate detector fuzzy matching
- **Evidence confidence:** **Confirmed**
- **Evidence:** `Client.find({ isActive: true })` in fuzzy matching path does not include firm scoping. (`src/services/clientDuplicateDetector.js`)
- **Why it matters:** Cross-firm client records can influence duplicate suggestions.
- **Exploit scenario:** Firm A user receives similarity matches influenced by Firm B records.
- **Recommended fix:** Make firm scope mandatory in fuzzy-match query and service method contract.

### High 3 — Storage worker does pre-scope CaseFile load before tenant safety check
- **Evidence confidence:** **Likely**
- **Evidence:**
  - Worker receives `firmId` from queue job payload and later enforces tenant safety. (`src/workers/storage.worker.js`)
  - In `UPLOAD_FILE`, it does `CaseFile.findById(fileId)` before `assertTenantSafety(...)`. (`src/workers/storage.worker.js`)
  - Queue enqueue helper includes `firmId` in idempotency key and payload model. (`src/queues/storage.queue.js`)
- **Why it matters:** If queue trust boundary is compromised (misconfigured producer permissions, poisoned payload), worker may load cross-tenant object metadata before scoped rejection.
- **Exploit scenario:** Malicious or compromised queue producer submits mismatched `firmId/fileId` payload; worker fetches document prior to scope assertion.
- **Recommended fix:** Replace initial read with `CaseFile.findOne({ _id: fileId, firmId })`; keep `assertTenantSafety` as defense-in-depth.

### Medium 1 — Error details reflected to clients in download failure response
- **Evidence confidence:** **Confirmed**
- **Evidence:** Download handler returns `error: error.message` in JSON response path. (`src/controllers/case.controller.js`)
- **Why it matters:** Internal storage/provider error details can leak implementation hints.
- **Exploit scenario:** Triggerable download errors reveal provider/storage internals to clients.
- **Recommended fix:** Return generic message only; log details server-side with existing structured logging.

### Medium 2 — Public upload email template depends on APP_URL trust and sanitization assumptions
- **Evidence confidence:** **Needs verification**
- **Evidence:** Upload link is embedded into outbound HTML/text email templates. (`src/controllers/uploadSession.controller.js`)
- **Why it matters:** Misconfigured or untrusted `APP_URL` could create phishing-like link content.
- **Exploit scenario:** Environment misconfiguration injects unexpected host in client-facing email.
- **Recommended fix:** Add strict env validation/allowlist for external URL origins.

### Medium 3 — Storage service identifier normalization risk in folder bootstrap flow
- **Evidence confidence:** **Likely**
- **Evidence:** `Firm.findById(firmId)` is used in a path where callers may pass string IDs depending on boundary normalization. (`src/services/storage.service.js`)
- **Why it matters:** Type mismatch can cause unexpected fallback behavior in storage bootstrap.
- **Exploit scenario:** Operational mismatch leads to incorrect folder-resolution behavior.
- **Recommended fix:** Normalize and validate firm identifier format at service entry.

### Medium 4 — Hardening recommendation: add centralized log scrubber policy
- **Evidence confidence:** **Needs verification**
- **Evidence:** Audit confirmed several structured logs already redact sensitive fields in auth-related paths and tests, but no single centralized scrubber guarantee was confirmed for every logger callsite during this pass.
- **Why it matters:** Inconsistent future logging changes can reintroduce token/OTP/password/hash leakage.
- **Exploit scenario:** New debug/error log path emits sensitive values.
- **Recommended fix:** Add a shared scrubber utility and regression tests for secrets redaction.

### Low 1 — UI build reported invalid utility theme token warning
- **Evidence confidence:** **Confirmed**
- **Evidence:** `npm --prefix ui run build` outputs an invalid utility theme warning.
- **Why it matters:** Not directly exploitable; indicates config hygiene drift.
- **Recommended fix:** Clean UI theme token configuration.

### Low 2 — Dependency CVE audit incomplete in this run
- **Evidence confidence:** **Confirmed**
- **Evidence:** `npm audit --omit=dev` returned HTTP 403 from advisory endpoint.
- **Why it matters:** Cannot confirm dependency vulnerability posture from this environment.
- **Recommended fix:** Re-run dependency audit in CI with advisory access and block beta on unresolved critical/high CVEs.

## Not yet verified
1. Route-level limiter coverage and middleware order for **all** public upload/session endpoints beyond explicit route definitions.
2. Full queue trust boundary (which services can enqueue to storage queue; infra-level auth/ACL guarantees).
3. End-to-end middleware ordering impact for upload/session endpoints under `createApp` dynamic route mounting.
4. Dependency CVE audit completion (blocked by `npm audit` 403 in this environment).

## Suggested PR order
1. **PR 1 (confirmed high fixes only):**
   - Add limiter coverage for `GET /upload/:token/meta`.
   - Fix tenant scope bug in duplicate detector fuzzy query.
   - Remove download error detail reflection.
2. **PR 2 (high-risk hardening with verification tasks first):**
   - Verify queue producer trust boundary + enforce producer restrictions.
   - Then scope initial worker lookup by `firmId`.
3. **PR 3 (medium hardening):**
   - APP_URL/externals validation.
   - Firm identifier normalization at storage boundary.
   - Centralized log scrubber + guardrails.
4. **PR 4 (tests/docs):**
   - Regression/security tests and runbook updates.

## Tests to add
- Public upload rate-limit coverage tests for `/upload/:token/meta`, `/upload/:token`, `/upload/:token/request-pin`.
- Tenant isolation regression for duplicate detector requiring firm scope.
- Worker queue payload mismatch tests (`firmId` vs `fileId`) and reject-before-processing expectations.
- API error response tests to ensure no raw internal error details are returned.
- Log redaction regression tests for token/otp/password/hash/cookie patterns.

---

## Appendix A — Files inspected
- `src/routes/public.routes.js`
- `src/middleware/rateLimiters.js`
- `src/app/createApp.js`
- `src/controllers/uploadSession.controller.js`
- `src/services/clientDuplicateDetector.js`
- `src/workers/storage.worker.js`
- `src/queues/storage.queue.js`
- `src/controllers/case.controller.js`
- `src/services/storage.service.js`
- Additional broad scan over `src/` and `ui/` with security-focused patterns.

## Appendix B — Commands run
- `npm audit --omit=dev`
- `npm run test:security:pure`
- `npm run lint`
- `npm --prefix ui run build`
- `npm --prefix ui run test:ci`
- `rg -n "dangerouslySetInnerHTML|innerHTML|eval\(|Function\(|child_process|exec\(|passwordHash|loginOtp|forgotPasswordOtp|token|cookie|findById\(|findOne\(|Attachment\.find|File\.find|Client\.find|User\.find|Case\.find|req\.params|req\.query|req\.body|res\.redirect|CORS|csrf|upload|download" src ui --glob '!**/dist/**' --glob '!**/node_modules/**'`
- Focused verification commands for route/middleware/queue paths.

## Appendix C — Commands blocked/failed
- `npm audit --omit=dev` failed with `403 Forbidden` from npm advisory endpoint.

## Appendix D — Search pattern categories used
- XSS/dynamic code: `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `Function(`
- Process execution: `child_process`, `exec(`
- Auth/session secrets: `passwordHash`, `loginOtp`, `forgotPasswordOtp`, `token`, `cookie`
- Tenant/data-access primitives: `findById(`, `findOne(`, `Attachment.find`, `File.find`, `Client.find`, `User.find`, `Case.find`
- Untrusted input surfaces: `req.params`, `req.query`, `req.body`
- Redirect/CORS/CSRF/upload/download surfaces: `res.redirect`, `CORS`, `csrf`, `upload`, `download`

## Appendix E — Known limitations
- Dependency CVE scan incomplete due to npm advisory endpoint 403.
- This pass emphasized static review and targeted command-driven inspection; no dynamic penetration test was executed.
- Some findings are explicitly marked **Likely** or **Needs verification** where infra/runtime guarantees were not fully observable from repository code alone.
