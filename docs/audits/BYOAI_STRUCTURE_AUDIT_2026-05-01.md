# BYOAI Structure Audit — 2026-05-01

## Purpose
This audit evaluates Docketra's BYOAI readiness using the existing BYOS control-plane architecture as the reference pattern.

## Executive Summary
As of this audit, **BYOAI runtime implementation is not verified as present production architecture**. The repository does show a mature **BYOS/storage control-plane foundation**, which should be treated as the blueprint for BYOAI implementation.

This document defines:
- what was verified in the repository,
- what was not verified for BYOAI runtime,
- and the recommended target architecture + implementation sequence.

## Evidence reviewed

### Verified foundation (exists in repo)
The following BYOS/storage architecture artifacts were reviewed and used as reference:
- BYOS architecture docs and setup docs.
- Storage routes/controllers/services and provider-factory patterns.
- Storage ownership/trust messaging in docs.

These provide a proven control-plane model: tenant-scoped governance, provider abstraction, configuration boundaries, and metadata-driven observability.

### Not verified as existing BYOAI runtime
During this audit, BYOAI runtime capabilities were treated as **unverified/planned** unless directly confirmed in the current repository state.

Accordingly, this audit does **not** assert as fact that production-ready BYOAI runtime modules (provider dispatch/orchestration, firm-level AI data model fields, AI audit pipeline, or full AI settings API surface) are already implemented.

## Current state assessment

## 1) BYOAI implementation status
- **Status:** planned / not fully verified as present.
- **Conclusion:** BYOAI should be implemented as a new architecture track aligned to existing BYOS principles.

## 2) BYOS alignment baseline
BYOS establishes the pattern to follow:
- Docketra as control plane for policy/orchestration/audit.
- External provider execution with tenant-controlled configuration.
- Metadata-first persistence.
- Clear ownership and trust boundaries.

BYOAI should mirror this exactly.

## 3) Trust boundary requirements (target)

### 3.1 Tenant ownership boundary
- All BYOAI operations must resolve firm ownership/tenant scope first.
- Ownership lookup failures must fail closed.

### 3.2 Credential boundary
- Credentials must be encrypted at rest.
- Secret reference mode should be preferred for production.
- Secrets must never be returned in API responses.

### 3.3 Data egress boundary
- Docketra must not silently send firm/client data to AI providers.
- Every AI request must pass explicit policy checks and admin-enabled conditions.

## 4) Retention and privacy requirements (target)
- Default posture: `zero retention` ON.
- Default posture: raw prompt/response persistence OFF.
- Prompt/output storage only when explicitly enabled by firm admin, with policy and retention window controls.

## 5) Audit and metering requirements (target)
- Metadata-only AI audit logging (request id, firm id, feature, provider, model, status, latency, token usage, error code class).
- No raw prompt/response persistence by default.
- Usage metering rollups (daily/monthly/provider/model/feature) with optional firm-level limits.

## 6) RBAC and feature gating requirements (target)
- Firm-level master enable/disable toggle.
- Feature-level toggles (e.g., document analysis, drafting, routing suggestions).
- Role-based access controls aligned to Docketra hierarchy:
  - `PRIMARY_ADMIN > ADMIN > MANAGER > USER`

## Recommended target structure (planned)

## A) Backend modules (proposed)
1. `src/services/ai/policy/aiPolicy.service.js`
2. `src/services/ai/credentials/aiCredentialResolver.service.js`
3. `src/services/ai/redaction/aiRedaction.service.js`
4. `src/services/ai/providers/providerRegistry.js`
5. `src/services/ai/metering/aiUsageMetering.service.js`
6. `src/services/ai/audit/aiAuditWriter.service.js`

> Note: module names above are future structure proposals, not claims of current implementation.

## B) Frontend settings structure (proposed)
- `ai.enabled`
- `ai.provider`, `ai.model`
- `ai.credentials` (masked/reference-first)
- `ai.features`
- `ai.roleAccess`
- `ai.retention`
- `ai.privacy`
- `ai.usage` (read-only metering summary)

## C) Provider abstraction contract (proposed)
- Unified provider interface for analyze/drafting/routing operations.
- Capability metadata per provider.
- Strict policy gate before invocation.
- Normalized non-sensitive error model.

## Required implementation PR sequence
1. **PR-1: Architecture contracts**
   - Policy engine skeleton, provider registry contract, test scaffolding.
2. **PR-2: Credential resolver**
   - Encrypted key handling + secret-reference adapters/rotation hooks.
3. **PR-3: Redaction pipeline**
   - Pre-provider minimization and policy version tagging.
4. **PR-4: Audit + metering layer**
   - Metadata-only logs and usage rollups.
5. **PR-5: Settings/API + UI contract alignment**
   - Firm-level controls, RBAC gates, retention/privacy controls.
6. **PR-6: Provider integrations**
   - Add provider-specific runtime logic only after contract and safety checks pass.

## Non-goals in this PR
- No runtime provider-call implementation.
- No AI SDK additions.
- No production behavior changes.
- Documentation-only changes.

## Conclusion
Docketra has a strong BYOS control-plane reference architecture. BYOAI should be implemented as a planned, staged extension of that model with strict trust boundaries, default-disabled posture, no silent data egress, encrypted credentials, metadata-only observability, and zero-retention defaults.
