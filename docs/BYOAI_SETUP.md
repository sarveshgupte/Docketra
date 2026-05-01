# BYOAI Setup (Control-Plane Aligned)

> Date: May 1, 2026  
> Status: Target architecture and setup guidance (documentation-only)

## 1) Principles
Docketra BYOAI should follow the same philosophy as BYOS:
- Docketra is the **control plane** (policy, access, audit, orchestration).
- Firm-selected providers are the **execution plane**.
- Firm/client sensitive data is never sent silently; AI usage must be explicit, optional, and admin-controlled.

## 2) Current repo status
- BYOS/storage control-plane architecture is present and serves as the reference pattern.
- BYOAI runtime/provider integration should be treated as a planned architecture track.
- This document defines target-state requirements and a safe implementation sequence.

## 3) Trust boundaries

### Boundary A — Firm policy boundary
Only firm admins (including primary admin) should configure provider, feature toggles, role access, and retention/privacy posture.

### Boundary B — Credential boundary
Credentials must be encrypted at rest. Secret-reference mode should be preferred for production. Credential values must never be returned in API responses.

### Boundary C — Data boundary
Default posture is metadata-only audit logs and zero-retention. Raw prompts/responses must not be persisted unless explicitly enabled by firm admin.

## 4) Safe enablement checklist (target rollout)
1. Confirm firm has completed BYOS/storage ownership review.
2. Select provider/model with legal/compliance approval.
3. Configure credentials (prefer secret references).
4. Keep AI globally disabled until policy, RBAC, and retention settings are approved.
5. Enable only required features first (least privilege).
6. Monitor metadata-only AI audit/metering before broad rollout.

## 5) Recommended policy defaults
- `enabled = false`
- `retention.zeroRetention = true`
- `retention.savePrompts = false`
- `retention.saveOutputs = false`
- `privacy.redactErrors = true`
- `privacy.verboseLogging = false`
- Role access initially limited to `PRIMARY_ADMIN` and `ADMIN` until governance sign-off.

## 6) Target provider configuration model

## Required fields
- `provider`
- `model`
- credentials (`credentialRef` preferred; encrypted `apiKey` fallback)
- feature flags
- role-access matrix
- retention/privacy policy

## Invariants
- Provider switch requires valid credentials for target provider.
- AI cannot be enabled without provider + valid credential.
- Credential source can be exposed as status only (never value).

## 7) Prompt/redaction policy (target)
Before any provider call:
1. Policy evaluation (`firm enabled` + `feature enabled` + `role allowed`).
2. Redaction/minimization profile execution.
3. Audit metadata tagging with policy/redaction version.

Default: do not store raw prompts/responses.

## 8) Audit and metering requirements (target)

## Audit metadata
- request id
- firm id
- feature
- provider/model
- status/error class
- latency
- token usage
- policy/redaction version tags

## Metering
- daily/monthly token totals per firm
- provider/model/feature breakdowns
- optional soft/hard usage thresholds

## 9) RBAC model (target)
Respect Docketra hierarchy:
- `PRIMARY_ADMIN > ADMIN > MANAGER > USER`

Enforcement must be backend-authoritative.

## 10) Default-disabled and fail-closed behavior
- AI remains optional and disabled by default.
- Missing ownership mapping, missing credentials, or unsupported provider must fail closed.
- Core docket workflows must remain functional when AI is disabled.

## 11) BYOAI ↔ BYOS alignment
Shared control-plane principles:
- tenant ownership resolution,
- explicit admin consent,
- metadata-first observability,
- no secret exposure,
- no silent data egress.

## 12) Required implementation PR sequence
1. Policy-engine extraction.
2. Credential-reference resolver and rotation hooks.
3. Redaction pipeline and policy-version tagging.
4. Usage metering aggregates + admin APIs.
5. Settings/UI contract alignment and governance UX.
6. Provider integrations after safety parity checks.

## 13) Non-goals in this PR
- No provider SDK additions.
- No runtime provider call expansion.
- No production runtime behavior changes.

## 14) Implemented backend contract skeleton (2026-05-01)
The backend BYOAI contract skeleton is now implemented with fail-closed defaults and no provider runtime integrations.

### Added modules
- `src/services/ai/policy/aiPolicy.service.js`
- `src/services/ai/credentials/aiCredentialResolver.service.js`
- `src/services/ai/redaction/aiRedaction.service.js`
- `src/services/ai/providers/providerRegistry.js`
- `src/services/ai/audit/aiAuditWriter.service.js`
- `src/services/ai/errors/AiErrors.js`

### Current behavior
- Provider runtime calls are not implemented.
- External SDK/provider integrations (OpenAI/Gemini/Anthropic/Azure) remain a future PR.
- Registry currently exposes metadata + validation stubs only.
- AI contract defaults to disabled/fail-closed policy decisions unless explicit allowed state is passed.

## 15) Implemented firm AI config contract (2026-05-01)

Backend-authoritative firm AI configuration contract has been added with secure defaults.

### Implemented fields
- `enabled` (default `false`)
- `provider` (`openai | gemini | anthropic | azure_openai | docketra_managed | null`)
- `model`
- `credentialMode` (`none | encrypted_key | credential_ref`)
- `encryptedKey` (canonical future secret field; stored, never exposed by safe config helpers)
- `credentialRef` (stored, never exposed by safe config helpers)
- `apiKey` (legacy/deprecated compatibility read path only)
- `features` (`taskDescriptionRefinement`, `documentSummary`, `docketDrafting`, `routingSuggestions`)
- `roleAccess` (`PRIMARY_ADMIN`, `ADMIN`, `MANAGER`, `USER`)
- `retention` (`zeroRetention`, `savePrompts`, `saveOutputs`)
- `privacy` (`redactErrors`, `verboseLogging`)
- `updatedAt`, `updatedBy`

### Safety guarantees implemented
- Default-disabled and fail-closed normalization.
- `zeroRetention=true` forces prompt/output retention flags to `false`.
- Safe config output exposes status/flags only and does not return key/ref secret values.
- Enablement validation returns structured failures for missing provider/model/credential state.

### Current limitations (intentional)
- Credential reference resolution is still contract-only (`CREDENTIAL_REF_LOOKUP_NOT_IMPLEMENTED`).
- Runtime credential decryption/use is intentionally not enabled in this PR; resolver reports presence/state only.
- Provider SDK integrations and real provider calls remain a future PR.
