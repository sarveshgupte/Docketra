# Full Repository Audit — 2026-04-17

## Scope
Backend-focused architectural and production-readiness audit of Docketra multi-tenant SaaS backend.

## Snapshot
- Large monolithic API bootstrap in `src/server.js` with broad middleware and route wiring.
- Security controls are present (Helmet, rate limiting, auth boundaries, tenant guards), but there are reliability and maintainability hotspots.
- Testing coverage breadth is strong, CI runs tests + npm audit, but architecture shows signs of scale strain.

## Scorecard (0–10)
- Architecture: 6.7
- Code Quality: 6.1
- Scalability: 5.8
- Security: 7.2
- Production Readiness: 6.4

## Strengths
1. Strong multi-tenant guardrails at multiple layers:
   - Route-level tenant middleware and invariants in server wiring.
   - Model-level tenant scope guard plugin.
2. Security hardening posture is above average:
   - Helmet, restrictive CSP in production, rate limiting, metrics endpoint token gate.
3. Validation discipline is enforced:
   - Startup check for route-schema coverage and route-level validation wrappers.
4. Structured logging with request/tenant/user correlation.
5. Extensive automated tests and CI gates (lint, test, build, audit).

## Critical Risks (High Priority)
1. Reliability risk from in-process side-effect queue.
   - Queue + retries exist only in process memory; crashes/restarts can drop queued work.
   - This becomes a primary data-loss risk under horizontal scaling.
2. Error contract inconsistency can produce weak client UX and brittle integrations.
   - Validation emits `{ error: { ... } }` while response contract expects top-level `message/error`, risking non-human messages.
3. Architectural concentration in oversized controllers and bootstrap file.
   - Auth controller and server composition are very large, increasing regression risk and lowering change velocity.
4. Logging of encrypted payload fragments and diagnostic previews.
   - Partial encrypted values and decrypted previews are logged in troubleshooting paths; this expands sensitive-data exposure blast radius.
5. Route duplication / mounting complexity.
   - Similar `case.routes` + `docket.routes` and multiple mounts increase drift risk and operator confusion.

## Medium / Low Issues
- README architecture is outdated vs current codebase layout and complexity.
- Aggressive default rate limits may be too permissive if production overrides are missed.
- Case model has a very high index count; write overhead/index maintenance cost should be measured.

## Missing Capabilities (Important)
- Durable outbox/event delivery (idempotent worker consumption with persistence).
- SLO/error-budget style observability (alerts tied to saturation, error rate, queue lag).
- First-class API versioning and deprecation policy.
- Tenant-level backup/restore and data retention playbooks.
- Automated performance regression testing for hot query paths.

## Architecture Maturity
- Current level: late early-stage / pre-scaling.
- Biggest bottleneck: monolithic control plane (server bootstrap + large controllers) coupled with non-durable asynchronous side effects.

## Top 5 Recommended PRs
1. **PR: Replace in-memory side-effect queue with durable outbox + worker consumer**
   - Problem: Side effects can be lost on restart and are not horizontally consistent.
   - Solution: Persist side effects in Mongo outbox table/collection with status, retries, backoff, idempotency key; consume with worker loop.

2. **PR: Standardize error envelope at source and contract middleware**
   - Problem: Mixed `{ error: {...} }` and `{ message, code }` responses.
   - Solution: Introduce single `ApiError` shape and normalize validation middleware to emit contract-compatible payload.

3. **PR: Split auth controller into bounded services + thin controller**
   - Problem: Auth controller is too large and multi-responsibility.
   - Solution: Separate login, OTP, token lifecycle, invites, password recovery into modules with shared policy helpers.

4. **PR: Consolidate case/docket routing with compatibility adapter**
   - Problem: Near-duplicate route trees increase drift.
   - Solution: Keep one canonical router (`docket.routes`) and map legacy aliases to canonical handlers with deprecation telemetry.

5. **PR: Sensitive logging policy hardening**
   - Problem: Diagnostic logs include encrypted substrings/decrypted previews in failure flows.
   - Solution: Introduce explicit safe-log schema for crypto paths; remove value previews and restrict debug diagnostics to gated secure mode.

## Final Verdict
- Not yet fully production-ready for 10x growth.
- Strong security intent and test breadth exist, but reliability and architectural maintainability risks are material.
- With the 5 PRs above (especially durable outbox + controller decomposition), this can move to scaling-ready maturity.
