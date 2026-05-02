# Docketra PRD/MVP Gap Analysis (May 2026)

## Scope and method
This audit compares the live codebase against:
- `docs/product/PRD_DOCKETRA.md`
- `docs/product/MVP_SCOPE.md`
- `docs/product/MODULE_REQUIREMENTS.md`
- `docs/product/USER_ROLES_AND_PERMISSIONS.md`
- `docs/product/NON_NEGOTIABLES.md`

It is evidence-based only (no speculative implementation assumptions), and maps each claim to concrete files/routes/modules.

---

## 1) MVP requirements already satisfied

### Firm-scoped routing and tenant enforcement (largely in place)
- Tenant-scoped API mounts are consistently protected with `tenantScopedApiAccess` / `adminTenantScopedApiAccess` and auth middleware across dockets, CRM, CMS, reports, users, etc. (`src/app/createApp.js`).
- Canonical docket routing exists on `/api/dockets`, with backward-compat alias `/api/cases` to preserve existing flows (`src/app/createApp.js`).
- Firm login endpoints are slug-scoped and separated from superadmin login surfaces (`src/app/createApp.js`).
- Firm context guard explicitly blocks superadmin from firm-scoped paths (`src/middleware/firmContext.js`, `src/middleware/invariantGuard.js`).

### Docket/task lifecycle baseline present
- Docket/case repositories and services implement CRUD/lifecycle patterns with tenant IDs and audit hooks (`src/repositories/CaseRepository.js`, `src/services/docketWorkflow.service.js`, `src/models/DocketAuditLog.model.js`).
- Worklist/workbasket-related routes are mounted and available (`src/app/createApp.js`, `/api/worklists`, `/api/admin/workbaskets` via admin schema references).

### CRM and CMS module surfaces present
- CRM endpoints for leads and CRM clients are mounted tenant-scoped (`src/app/createApp.js`: `/api/leads`, `/api/crm/clients`, `/api/clients`).
- CMS intake/public surfaces are mounted (`/api/public`, forms/landing pages in tenant APIs) with legacy deprecation path clearly handled (`src/app/createApp.js`).

### Security baseline controls present
- Rate-limiting middleware is wired through public/auth/superadmin/tenant routes (`src/app/createApp.js`, `src/middleware/rateLimiters.js`).
- Encryption and tenant-key model exist with tenant-required guards (`src/security/encryption.service.js`, `src/security/tenantKey.model.js`, `src/security/encryption.local.provider.js`).
- Structured error chain is present (`notFound`, `uploadErrorHandler`, `errorHandler` in `src/app/createApp.js`).

---

## 2) MVP requirements partially satisfied

### Auth/session reliability
- Positive: clear route separation for tenant vs superadmin login and auth route mounts exists (`src/app/createApp.js`).
- Gap: this audit found route/middleware structure but not an explicit critical-flow gate artifact proving pass status for login/logout/OTP/reset in this document set.
- Classification: **beta blocker** (evidence of architecture present, but release gate evidence incomplete in this audit slice).

### Role hierarchy alignment
- Product docs require `primary_admin > admin > manager > user` (`docs/product/USER_ROLES_AND_PERMISSIONS.md`).
- Codebase contains mixed role systems (`PRIMARY_ADMIN/ADMIN/MANAGER/USER` in many models/services) **and** legacy-style checks using `Admin/Employee` in several policies (`src/policies/*.policy.js`, `src/schemas/user.routes.schema.js`).
- This indicates partial alignment with potential enforcement drift between modules.
- Classification: **release blocker** for strict PRD conformance.

### BYOS-first with secure fallback
- BYOS/storage modules exist and are tenant guarded (`/api/storage`, `/api/tenant`, storage worker/queues).
- But admin controller contains an environment branch returning a coming-soon storage message (`src/controllers/admin.controller.js`).
- Classification: **beta blocker** if this branch can appear in intended beta environments.

### Reports/diagnostics and auditability
- Reports, insights, admin audit, and superadmin diagnostics routes are mounted (`src/app/createApp.js`; audit models/services exist).
- Remaining gap is operational proof (runbook/test gate evidence) rather than missing modules.
- Classification: **post-MVP improvement** for broader observability hardening docs; **beta blocker** only if no release checklist enforces it.

---

## 3) MVP blockers

## Release blockers
1. **Role enforcement inconsistency across modules**
   - Mixed role vocabularies (`Admin/Employee` vs `PRIMARY_ADMIN/ADMIN/MANAGER/USER`) can produce authorization divergence and violate mandated hierarchy.
   - Evidence: `src/policies/case.policy.js`, `src/policies/client.policy.js`, `src/policies/user.policy.js`, `src/schemas/user.routes.schema.js`, vs `src/models/User.model.js` and hierarchy services.

2. **Placeholder/incomplete production capability in AI runtime providers**
   - Claude/Gemini providers throw not implemented errors; controller explicitly frames runtime validation as not implemented.
   - Evidence: `src/services/ai/providers/claude.provider.js`, `src/services/ai/providers/gemini.provider.js`, `src/controllers/ai.controller.js`.
   - Note: if AI is optional and correctly gated, this may downgrade to beta blocker; currently exposed API surface makes it a release concern unless clearly non-production-gated.

## Beta blockers
1. **Storage onboarding path may surface coming-soon behavior**
   - Evidence: `src/controllers/admin.controller.js` coming-soon branch.

2. **Auth/session reliability evidence gap**
   - Architecture appears robust, but this audit did not identify a single authoritative pass artifact proving OTP/reset/login/logout flows at beta gate.

3. **Route naming drift (`case` vs `docket`) still broad in backend contracts**
   - Compatibility alias is expected, but deep persistence of case naming across repositories/models/policies increases risk of semantic and permission drift.
   - Evidence: `src/repositories/CaseRepository.js`, `src/models/Case.model.js`, `src/routes` mounts in `createApp`.

## Post-MVP improvements
- Expand automated route inventory/coverage in CI (already documented as constrained in product docs).
- Consolidate policy layer on canonical role utility functions across all modules.
- Broaden performance SLO instrumentation for pilot dashboards/queues.

---

## 4) Broken or placeholder production surfaces

1. **AI providers are explicit stubs**
   - `Claude provider is not implemented`
   - `Gemini provider is not implemented`
   - Files: `src/services/ai/providers/claude.provider.js`, `src/services/ai/providers/gemini.provider.js`.

2. **AI config endpoint acknowledges runtime validation incomplete**
   - Message: configuration valid, runtime provider validation not implemented.
   - File: `src/controllers/ai.controller.js`.

3. **Storage setup can return coming-soon**
   - Message: “Connect Your Storage is coming soon for this environment.”
   - File: `src/controllers/admin.controller.js`.

4. **KMS encryption provider is not implemented**
   - Throws `KMS provider not implemented` for all core methods.
   - File: `src/security/encryption.kms.provider.js`.
   - Impact depends on deployment profile; if local provider is the supported prod path, this is controlled technical debt. If KMS is expected in target environment, blocker.

---

## 5) Security / tenant-isolation risks

1. **Authorization drift due to mixed role enums (high risk)**
   - Tenant guards are strong, but policy mismatch can still grant/deny actions inconsistently.
   - Files: `src/policies/*.policy.js`, `src/schemas/user.routes.schema.js`, `src/models/User.model.js`.

2. **Superadmin boundary generally protected (positive), but must remain invariant-tested**
   - Explicit superadmin-forbid checks are present on firm context and invariant guard.
   - Files: `src/middleware/firmContext.js`, `src/middleware/invariantGuard.js`, `src/repositories/CaseRepository.js`, `src/repositories/ClientRepository.js`.

3. **Tenant key / encryption fallback complexity**
   - Local tenant-key encryption path is solid, but alternative provider path (KMS) is stubbed, increasing risk if misconfigured in deployment.
   - Files: `src/security/encryption.service.js`, `src/security/encryption.kms.provider.js`.

---

## 6) Auth/session/routing risks

1. **Firm and platform auth route collisions are intentionally managed** (positive)
   - Superadmin routes mounted before `/:firmSlug` auth routes to avoid slug collision.
   - File: `src/app/createApp.js`.

2. **Legacy and canonical route coexistence increases regression surface**
   - `/api/cases` alias + `/api/dockets` canonical route is pragmatic but doubles contract maintenance burden.
   - File: `src/app/createApp.js`.

3. **Critical auth flow confidence depends on test gate visibility**
   - Routes exist; this audit did not trace a consolidated beta gate report artifact confirming pass/fail for login/logout/reset/OTP.

---

## 7) Suggested PR sequence to reach beta readiness

### PR-1 (Release blocker): Canonical role-contract unification
- Standardize authorization/policy checks on canonical role utility + hierarchy contract.
- Remove `Admin/Employee` drift from policies/schemas where incompatible with current role model.
- Add regression tests for hierarchy (`primary_admin > admin > manager > user`) and superadmin exclusion from tenant data.

### PR-2 (Release/Beta blocker): Production-surface hardening for AI + storage placeholders
- Ensure AI runtime endpoints are explicitly gated/off when provider runtime is not implemented, with non-broken UX/API behavior.
- Remove or environment-gate “coming soon” storage responses from production routes.

### PR-3 (Beta blocker): Auth/session critical-flow release gate
- Add/standardize an executable gate covering tenant login/logout/OTP/reset + superadmin login + redirect/context invariants.
- Publish machine-readable pass artifact for release checklist.

### PR-4 (Beta blocker): Route contract and naming stabilization
- Preserve `/api/cases` compatibility alias, but enforce canonical docket naming in new surfaces/docs/contracts.
- Add contract tests ensuring parity and no permission divergence between alias and canonical paths.

### PR-5 (Post-MVP improvement): Diagnostics and ops maturity pack
- Consolidate runbooks and evidence links for auth/upload/performance incidents.
- Extend route inventory and smoke coverage in CI where environment allows.

---

## Priority classification summary

### Release blockers
- Role-contract inconsistency across policy/schema/model layers.
- Exposed placeholder runtime behavior on AI provider surfaces (unless fully gated out of production profile).

### Beta blockers
- Storage coming-soon branch in active admin path.
- Missing consolidated auth/session critical-flow gate artifact in this audit scope.
- Semantic drift risk from legacy `/cases` depth.

### Post-MVP improvements
- CI route-inventory hardening and broader performance diagnostics.
- Additional provider maturity (e.g., KMS path) if/when required by deployment profile.
