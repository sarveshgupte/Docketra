# Team Management Settings Hardening Audit (2026-05)

## Scope
Frontend and backend team-management surfaces were audited and hardened for private-pilot readiness across role assignment, status changes, workbasket/QC mapping, and schema strictness.

## Role matrix
- Primary Admin (non-assignable, exactly one per firm, inherits Admin).
- Admin (assignable).
- Manager (assignable).
- Employee/User (assignable UI alias -> backend `USER`).
- SuperAdmin is platform-only and excluded from firm role assignment.

## Assignable role contract
Assignable roles in Team Management are: `Admin`, `Manager`, `Employee` (canonicalized to `USER`).
Primary Admin and SuperAdmin are explicitly non-assignable.

## Hardening changes
- Enforced Team Management denial copy consistency: "Admin access is required to manage team members.".
- Updated empty state copy to: "No team members added yet".
- Hardened admin route validation schemas for user create/status/workbasket mutation endpoints with strict payload contracts.
- Removed primary-admin-only gate from activate/deactivate/workbasket assignment endpoints so Admin can manage non-primary users while existing primary-admin protections in business logic remain in effect.

## Workbasket / QC behavior
- Team create/edit flows continue to require at least one workbasket assignment.
- QC workbasket assignment remains explicit and optional.
- Sidebar/deep route access continues to be assignment-driven.

## Bulk upload role contract
- Allowed roles: Admin, Manager, Employee.
- Employee canonicalization to backend `USER` remains required.
- Primary Admin and SuperAdmin remain invalid in bulk role assignment contract.

## Tests run
- `node ui/tests/adminSurfaceHardening.test.mjs` (initially failed due legacy path mismatch; fixed in PR #1339 follow-up and now passing)
- `node ui/tests/teamManagementHardening.test.mjs`

## Remaining limitations
- Full row-level bulk upload partial-failure UX depends on existing bulk pipeline implementation details.
- Audit event payload parity for every action should continue to be expanded in service-level tests.

## Readiness score
**8.5 / 10** for private pilot, with core role-boundary and schema-hardening controls in place.
