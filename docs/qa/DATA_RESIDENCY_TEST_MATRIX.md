# Data Residency Test Matrix

Date: 2026-05-24

This matrix indexes the authoritative data-residency and BYOS cloud-first transition test coverage used in PR validation.

## Required tests

| Test name | Coverage focus | Expected outcome |
|---|---|---|
| `dataResidency.mongoSchemaGuard` | Guards Mongo schemas against new prohibited firm business-content fields; tracks temporary exceptions with removal intent. | Fails on unapproved business-content field additions in Mongo models. |
| `byosRootIdentity` | Verifies Google Drive root identity binding via folder ID + manifest and reconnect behavior. | Reconnect reuses bound root; invalid identity enters recovery-required state. |
| `storageGoogleOAuth` | Validates Google BYOS OAuth connect/callback contract and provider state handling. | OAuth lifecycle works with sanitized responses and correct provider activation. |
| `storageController` | Covers storage settings/control-plane endpoints, status transitions, and sanitized diagnostics behavior. | Control-plane state updates correctly without leaking secrets. |
| `clientFactSheet.cloudFirstStorage` | Verifies CFS canonical write path to cloud JSON and read hydration behavior. | CFS business content writes cloud-first; Mongo retains compatibility metadata only. |
| `docketNarrative.cloudFirstStorage` | Verifies docket narrative canonical cloud JSON writes and hydration fallback behavior. | Docket narrative writes to cloud ref; legacy fallback only when needed. |
| `taskNarrative.cloudFirstStorage` | Verifies task narrative canonical cloud JSON writes and hydration fallback behavior. | Task narrative writes to cloud ref; transitional compatibility remains safe. |
| `commentHistory.cloudFirstStorage` | Verifies comments and docket-history narrative canonical cloud JSON writes. | Comment/history business narrative writes cloud-first with transitional compatibility fields retained. |
| `caseQuery.commentHistoryHydration` | Verifies query/read surfaces hydrate comment/history narrative from cloud refs. | Read surfaces return expected narrative content from cloud refs (legacy fallback where needed). |
| `strictFirmOwnedStorage.enforcement` | Verifies strict firm-owned storage mode blocks business-content writes when BYOS root/health is invalid. | Protected writes are blocked until BYOS root health is restored. |

## Usage in PR review
- Treat this matrix as required verification for data-residency-impacting PRs.
- If a PR changes canonical write paths, hydration logic, strict mode, or storage identity behavior, update/add tests in this matrix in the same PR.
- Do not mark migration complete until temporary Mongo compatibility fields are removed and guardrail exceptions are retired.
