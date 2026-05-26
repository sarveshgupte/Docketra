# Docketra Simplification Audit — May 2026

## Goal and scope
This audit identifies unnecessary complexity, duplicated logic, stale docs/tests, over-engineered compatibility paths, and fragility from recent bugfixes. This is a **documentation-only** pass; no runtime code changes are proposed in this PR.

Guardrails respected:
- Do **not** weaken tenant isolation/security.
- Do **not** weaken auth.
- Do **not** delete production data paths.

---

## Top 10 complexity hotspots

1. **Auth flow branching across multiple entry points + storage of transient login state**  
   - Multiple paths (local login, OTP verification, forgot-password init/verify, reset) plus superadmin/firm split and pending session keys increase surface area and coupling.
   - Risk: regressions from UI state coupling and route-state assumptions.

2. **Tenant identity model is multi-source and partially compatibility-driven**  
   - `tenantId`, `firmId`, `defaultClientId`, `ownershipFirmId`, `legacyFirmId`, `firmSlug`, `firmIdString` coexist at runtime.
   - Risk: subtle scope drift and repeated conversion logic.

3. **Tenant resolution logic duplicated across middleware and auth runtime context assembly**  
   - `tenantResolver`, `attachFirmFromSlug`, `firmResolution` + auth middleware all assemble overlapping context objects.
   - Risk: divergence in edge-case behavior and stale assumptions.

4. **Client encryption/tenant-key fallback paths are safety-oriented but operationally dense**  
   - Candidate lookup and repair/recovery flows introduce many “if legacy then fallback” branches.
   - Risk: harder on-call debugging and higher change risk.

5. **Worklist/workbasket authorization model carries transitional fields**  
   - `teamId` + `teamIds` + `workbaskets[]` + `parentWorkbasketId` patterns imply compatibility layering.
   - Risk: ambiguity around “source of truth” for authorization.

6. **Public upload token flow has split protections by route**  
   - POST routes visibly throttled while GET metadata endpoint remains differently treated.
   - Risk: uneven anti-abuse behavior and policy drift.

7. **Test suite contains many implementation-string assertions**  
   - Several UI tests assert exact source substrings/regex rather than behavioral outcomes.
   - Risk: high churn on refactors without real behavior changes.

8. **Docs sprawl: release notes and findings distributed across many standalone files**  
   - `docs/whats-new.md` has grown large and mixes major/minor notes; multiple audits/findings are scattered.
   - Risk: stale duplication and unclear “single source of truth”.

9. **Legacy naming compatibility (`case` vs `docket`) remains pervasive**  
   - Domain model and many APIs/services still use case-named internals while product terminology is docket-first.
   - Risk: cognitive overhead for contributors and reviewers.

10. **Rate-limit/security controls are present but ownership is fragmented**  
   - Security controls are spread between global middleware, route middleware, and feature controllers.
   - Risk: difficult to verify complete coverage quickly during incident response.

---

## Focus analysis

## 1) Auth flow complexity (local password, OTP, forgot-password, reset, future Google auth)
### Current complexity
- Auth middleware has separate superadmin fast-path and normal user DB path, with must-set-password exceptions and tenant-context assembly in one large control flow.
- UI login/OTP flows rely on sessionStorage coordination keys (pending login token/firm/returnTo), and many tests enforce literal code shape.
- Turnstile is selectively enabled for signup and forgot-password init, adding branchy behavior by env.

### Keep
- Cookie-based auth model and current CSRF/origin protections.
- Explicit superadmin/firm namespace separation.
- OTP as controlled second step where required.

### Remove / hide / simplify
- **Hide/defer Google Auth integration** behind a feature flag until post-beta (no partial flow exposure).
- Consolidate transient auth-state handling into one shared frontend helper module (single API for set/clear/get pending auth state).
- Consolidate backend auth branch logging/response helpers to reduce repeated blocks.

### Defer until after beta
- Full auth-flow state machine rewrite.
- Protocol-level unification of all auth UX paths.

---

## 2) Tenant identity complexity (`firmId`, `defaultClientId`, `ownershipFirmId`, `legacyFirmId`, canonical tenant)
### Current complexity
- Canonical resolver already exists but still supports multiple historical shapes/sources and emits mixed identity fields for compatibility.
- Middleware/auth layers each remap identity fields.

### Canonical model recommendation
- **Canonical runtime tenant key:** `tenantId` (maps to default-client tenant model).
- **Ownership record key:** `ownershipFirmId` (for firm-owned config/billing/admin metadata).
- **Compatibility-only fields:** `legacyFirmId`, `firmIdString` (read-only adapters; not new write source).

### Migration plan (safe, staged)
1. Define one shared `TenantContext` contract used by all middleware/controllers.
2. Route all tenant derivation through `tenantIdentity.service` only (no local remapping variants).
3. Mark compatibility fields as deprecated in code comments/docs and stop introducing new usage.
4. Add runtime invariant logging when compatibility fields disagree.
5. Post-beta: remove dead compatibility readers once data migration is complete.

---

## 3) Client encryption complexity (key lookup candidates, repair endpoint, read-only mode, default client)
### Current complexity
- Security-safe fallback and repair behaviors exist, but key-candidate/fallback branching is hard to reason about quickly.

### MVP-safe simplification
- Keep read-only fail-safe mode and repair pathway.
- Introduce a **single ordered key lookup policy object** (centralized declarative order, not scattered conditionals).
- Standardize one user-facing error envelope for encryption-unavailable states.
- Treat default-client fallback as compatibility mode with explicit audit marker.

### Defer until after beta
- Removing legacy key candidates entirely.
- Data re-encryption migration with strict key lineage cleanup.

---

## 4) Worklist/workbasket complexity (`teamId`, `teamIds`, `workbaskets[]`, `parentWorkbasketId`)
### Current complexity
- Transitional representations coexist for assignment + visibility + QC linkage.

### One clear authorization model
- **Primary authorization source:** explicit membership arrays (`workbaskets[]` + `qcWorkbaskets[]`) scoped by tenant.
- `teamId` retained only as backward-compat projection for older consumers.
- `teamIds` treated as migration/compat list with deprecation path.
- `parentWorkbasketId` only for QC relationship integrity, not end-user authorization decisions.

### Defer until after beta
- Schema-level removal of compatibility fields.
- Full rename migration from team* to workbasket* internals.

---

## 5) Tests simplification audit
### String-inspection tests to convert to behavior tests (or remove)
- `ui/tests/postLoginFlowRegression.test.mjs` (heavy `.includes(...)` checks on source text).
- `ui/tests/authCookieClientConsistency.test.mjs` (source-string contract checks).
- `ui/tests/workbasketSidebarDirectLinks.test.mjs` (regex/static source assertions).
- Similar static inventory tests that assert implementation snippets rather than runtime behavior.

### Duplicate/overlapping patterns
- Multiple auth-routing tests assert overlapping login/redirect rules through source inspection instead of end-to-end behavior.
- Multiple navigation tests re-assert similar route constants and labels by source matching.

### Keep
- Security boundary tests that execute actual handlers/services and assert outcomes.
- Tenant isolation tests that exercise query scoping behavior.

### Cleanup direction
- Move critical flows to behavior tests (route response, guard output, auth context effects).
- Retain minimal static contract tests only where codegen-free API stability is needed.

---

## 6) Docs simplification audit
### Consolidate
- Keep `docs/whats-new.md` as release notes, but move incident/findings style entries into a single `docs/INCIDENTS_AND_FINDINGS.md` (or `CHANGELOG_SECURITY.md`) with index links.
- Consolidate scattered ad-hoc audit docs by adding a central index under `docs/audits/README.md`.

### Stale/redundant risks
- Large release notes file now mixes strategic notes, polish notes, and security changes in one stream.
- Multiple overlapping product/strategy docs risk conflicting statements about what is canonical vs transitional.

### Keep
- Product canonical docs (terminology, scope, non-negotiables).
- Security audit artifacts needed for compliance traceability.

---

## What to keep
- Strict tenant isolation controls and canonical tenant resolver service.
- Cookie auth + CSRF/origin hardening + OTP/forgot-password protections.
- BYOS-first posture and no-secrets-in-logs security constraints.
- Role hierarchy enforcement (`PRIMARY_ADMIN > ADMIN > MANAGER > USER`) and backend guard checks.

## What to remove (or phase out)
- New usage of legacy compatibility fields as first-class identifiers.
- New static source-string assertions for user-critical behavior where behavior tests are feasible.
- Repeated tenant-context assembly logic outside centralized identity helpers.

## What to defer until after beta
- Full compatibility-field deletion and schema cleanup.
- Major auth state machine redesign.
- Deep renaming migration of internal case/team legacy naming.

---

## Suggested PR sequence for cleanup
1. **PR A (Low risk): Test modernization phase 1**  
   Convert high-churn string-inspection tests to behavior tests for auth redirects and route guards.

2. **PR B (Medium risk): Tenant context contract unification**  
   Introduce shared `TenantContext` builder and adopt in middleware/auth without changing external behavior.

3. **PR C (Medium risk): Workbasket authorization model clarification**  
   Make `workbaskets[]/qcWorkbaskets[]` explicit source-of-truth in guards; keep `teamId/teamIds` compatibility projections.

4. **PR D (Medium risk): Auth state helper consolidation**  
   Frontend-only consolidation of pending-login/OTP state storage helpers.

5. **PR E (Low risk): Docs consolidation**  
   Add findings/incidents index and streamline release notes references.

6. **PR F (High risk, post-beta): Compatibility removal migrations**  
   Remove legacy identity/workbasket aliases and dead paths after data/runtime verification.

---

## Cleanup risk table
| Cleanup item | Risk | Why |
|---|---|---|
| Convert string-inspection tests to behavior tests | Low | Test-only changes; improves refactor safety. |
| Add shared TenantContext contract | Medium | Cross-cutting middleware/auth touchpoints. |
| Clarify workbasket auth source-of-truth | Medium | Authorization paths are sensitive. |
| Consolidate frontend auth transient state helpers | Medium | Could affect login/OTP edge flows if not covered. |
| Docs consolidation (findings/changelog/index) | Low | Non-runtime changes. |
| Remove compatibility identity fields | High | Requires migration confidence and broad validation. |

---

## Evidence pointers (representative)
- Auth middleware multi-branching and tenant context assembly: `src/middleware/auth.middleware.js`
- Canonical tenant resolver and compatibility fields: `src/services/tenantIdentity.service.js`
- Tenant resolver context attachment and compatibility defaults: `src/middleware/tenantResolver.js`
- Public upload route middleware asymmetry: `src/routes/public.routes.js`
- Duplicate detector scoping complexity: `src/services/clientDuplicateDetector.js`
- String-inspection test examples: `ui/tests/postLoginFlowRegression.test.mjs`, `ui/tests/authCookieClientConsistency.test.mjs`, `ui/tests/workbasketSidebarDirectLinks.test.mjs`
- Docs sprawl indicator: `docs/whats-new.md`

