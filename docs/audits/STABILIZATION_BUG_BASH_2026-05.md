# STABILIZATION BUG BASH — 2026-05

## Scope
No-new-features stabilization pass across pilot-critical auth/admin/workflow/storage/public route flows.

## Bugs found

### 1) Admin role contract drift in Create User flow
- **Flow(s):** Primary Admin/Admin/Manager/Employee role behavior, Team Management role assignment.
- **Symptom:** CI stability suite failed at `ui/tests/adminSurfaceHardening.test.mjs` with: _"Create user modal should include Employee role label"_.
- **Root cause:** Create User modal exposed `Employee` label but internally posted role value as `USER`, while the contract hardening test required the explicit `Employee` option shape in UI. This created drift between UI role-pick contract and API canonical role handling.
- **Fix layer:** Contract boundary between Admin UI form and API payload.
- **Fix applied:**
  - Restored explicit Employee option value in Create User modal (`{ value: 'Employee', label: 'Employee' }`).
  - Added canonical normalization in submit path so Employee/User/Staff aliases always map to `USER` before API request.
- **Regression test:** Extended `ui/tests/adminSurfaceHardening.test.mjs` to assert submit-time role normalization remains in place.

## Fixes applied
- `ui/src/pages/admin/components/CreateUserModal.jsx`
  - Updated employee role option value to explicit `Employee` contract shape.
- `ui/src/pages/AdminPage.jsx`
  - Added role normalization in `handleCreateUser` payload construction to preserve backend role contract (`USER`) for employee aliases.
- `ui/tests/adminSurfaceHardening.test.mjs`
  - Added regression assertion for alias→canonical role mapping in create-user submit flow.

## Tests added/updated
- Updated: `ui/tests/adminSurfaceHardening.test.mjs`
  - New assertion verifies create-user payload normalization to `USER` for Employee/User/Staff aliases.

## Commands run
- `npm run test:pilot-hardening`
- `npm run test:pilot-readiness`
- `npm --prefix ui run test:admin-surface`

## Remaining risks
- Full E2E runtime validation across every listed flow still depends on environment-backed services (DB/storage providers) beyond static-contract and smoke suites.
- Some pilot-readiness suites emit transient DB buffering warnings in isolated test contexts; these do not currently fail contracts but should remain monitored.

## Private pilot readiness score
- **Score:** 8.8 / 10
- **Rationale:** Critical contract drift in role assignment path fixed with regression coverage; broad pilot hardening suites run and pass up to/including the impacted admin surface contract.
