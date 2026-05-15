# Work Management Settings Hardening Audit (May 2026)

## Scope covered in this PR
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
- `npm test -- tests/workManagementNoDeletePolicy.test.js --runInBand` (suite runs broader project test pipeline in this repo setup).

## Remaining limitations
- Full end-to-end UI routing-selector audits for all inactive edge cases were not refactored in this patch.
- Some integration tests are skipped in this environment due to Mongo binary availability issues.

## Readiness score
- **7.5 / 10** for private pilot hardening in this patch scope.
