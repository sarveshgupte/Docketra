# Client Management Settings Hardening Audit (2026-05)

## Scope
Admin-only Client Management (`/clients`) across route validation, permission-denial UX copy, and backend error sanitization.

## Role access matrix
| Role | View clients | Mutate clients/CFS |
|---|---|---|
| PRIMARY_ADMIN | ✅ | ✅ |
| ADMIN | ✅ | ✅ |
| MANAGER | ❌ (Client Management surface) | ❌ |
| USER/EMPLOYEE | ❌ (Client Management surface) | ❌ |
| SUPER_ADMIN | ❌ firm-scoped client routes | ❌ |

Note: any narrow client visibility used in docket-linked workflows is separate from the Client Management settings surface and does not grant `/clients` page access.

Denial copy hardened to: **"Client management requires Admin access."**

## Default firm client behavior
- Existing protections for default/system/internal client deactivation remain active in controller logic.
- This hardening pass did not alter default-client creation workflows; behavior remains tenant-scoped and guarded by existing services.

## Required/optional client fields
### Required (create)
- businessName
- businessEmail
- primaryContactNumber
- businessAddress
- city
- state
- pincode
- contactPersonName
- contactPersonEmail
- contactPersonPhone

### Optional
- PAN, GST, TAN, CIN and existing optional profile/statutory fields already accepted by route schema.

## Bulk upload field contract
- No contract shape change in this patch; remains aligned through existing client field alignment tests.

## CFS attachment storage behavior
- Upload-intent/finalize flow remains provider-resolved (BYOS-first with managed fallback) via existing CFS services.
- Error responses are sanitized to avoid leaking internal messages/secrets.

## Cloud-storage boundary findings
- This patch adds/retains validation and security guardrails and does not introduce new Mongo canonical client business fields.
- Existing cloud-first client persistence boundaries remain in place.

## Tests run
- `node tests/clientManagementPermissionsAndSchema.audit.test.js`
- `node tests/clientManagementFieldAlignment.test.js`

## Remaining limitations
- Wider end-to-end UI-flow and storage-provider integration tests are still recommended for pilot gate confidence.

## Readiness score
- **8.3 / 10** for Client Management settings hardening scope in this patch.
