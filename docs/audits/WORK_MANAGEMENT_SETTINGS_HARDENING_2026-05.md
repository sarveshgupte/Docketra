# Work Management Settings Hardening Audit (May 2026) — Slice 1 (Contract Hardening Only)

## Scope covered in this PR (Slice 1)
- Enforced deactivate-only policy at Admin API contract level for Categories/Subcategories.
- Removed Admin hard-delete route exposure for category/subcategory.
- Hardened Work Management mutation schemas to strict mode for key category/workbasket mutations.
- Sanitized category controller error responses to avoid raw backend error leakage.

## Role access matrix
| Role | Work Management UI/API |
|---|---|
| PRIMARY_ADMIN | Allowed |
| ADMIN | Allowed |
| MANAGER | Allowed |
| USER/EMPLOYEE | Denied |
| SUPER_ADMIN | Denied on firm-scoped admin routes |

## Lifecycle policy summary
- Categories/Subcategories/Workbaskets: create, rename, deactivate.
- Hard delete: not exposed in normal Work Management flows.
- Deactivated entries remain historically visible but excluded from active setup/routing selectors.

## QC linkage
- Primary workbasket creation continues to use guardrail service auto-linking (`createPrimaryWithQc`).
- Linked QC relationship is enforced by service-level guardrails and existing tests.

## Team Management boundary
- User assignment mutations remain under Team Management/Admin user-workbasket assignment routes.
- This PR does not move assignment logic into Work Management.

## Routing behavior
- New routing should use active mappings only; historical dockets retain labels.
- No data migration included in this PR.

## Storage boundary classification
- Current implementation stores category/subcategory/workbasket workflow config in tenant-scoped MongoDB collections (workspace business configuration data).
- No control-plane migration done in this PR.

## Tests run
- `npx jest tests/workManagementNoDeletePolicy.test.js --runInBand`
- `npm test -- tests/workManagementNoDeletePolicy.test.js --runInBand` (suite runs broader project test pipeline in this repo setup).

## Follow-up PRs required (not in this slice)
- Manager-and-above UI/sidebar visibility tests and Employee direct route denial UI tests.
- Backend Employee denial tests for all Work Management mutation surfaces.
- Primary workbasket auto-create exactly-one-linked-QC deterministic tests (including duplicate-retry behavior).
- Inactive category/subcategory/workbasket selector and routing protections for new docket creation tests.
- Primary workbasket deactivation linkage behavior tests for linked QC workbasket policy enforcement.

## Remaining limitations
- This slice does **not** complete end-to-end Work Management hardening; it focuses on route/schema/controller contract safety only.
- Some integration tests are skipped in this environment due to Mongo binary availability issues.

## Readiness score
- **6.5 / 10** for private pilot readiness overall; this slice improves baseline API safety but is intentionally partial.

## Slice 2 hardening update
- Work Management access is Manager-and-above only (`PRIMARY_ADMIN`, `ADMIN`, `MANAGER`); `USER`/Employee is denied.
- SuperAdmin remains blocked from firm Work Management surfaces.
- Creating a primary Workbasket auto-creates exactly one linked QC Workbasket named `${primaryWorkbasketName} — QC`.
- QC linkage uses `Team.parentWorkbasketId` on the QC workbasket and duplicate QC-per-primary remains blocked by unique index and creation guardrails.
- Primary rename now cascades to linked QC only when QC still matches generated default name.
- Primary deactivation now deactivates linked QC workbasket automatically.
- Team Management remains the only assignment surface for WB/QC membership; Work Management does not expose assignment controls.
- This slice does not change docket lifecycle routing/inactive selector behavior.
