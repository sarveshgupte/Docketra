# ROLE_HIERARCHY_AUDIT_2026-05

## Canonical hierarchy
- PRIMARY_ADMIN (rank 4)
- ADMIN (rank 3)
- MANAGER (rank 2)
- USER/EMPLOYEE/STAFF (rank 1)

## Helpers introduced/reused
### Frontend (`ui/src/utils/permissions.js`)
- `normalizeFirmRole(role)`
- `getFirmRoleRank(userOrRole)`
- `hasFirmRoleAtLeast(userOrRole, minimumRole)`
- `isPrimaryAdmin(user)`
- `isFirmAdminOrAbove(user)`
- `isFirmManagerOrAbove(user)`
- `canManageClients(user)` (reused + standardized)

### Backend (`src/utils/role.utils.js`)
- `normalizeFirmRole(role)`
- `getFirmRoleRank(userOrRole)`
- `hasFirmRoleAtLeast(userOrRole, minimumRole)`
- `isPrimaryAdmin(user)`
- `isFirmAdminOrAbove(user)`
- `isFirmManagerOrAbove(user)`

## Files audited
- `ui/src/utils/permissions.js`
- `ui/src/components/auth/ProtectedRoute.jsx`
- `ui/src/constants/platformNavigation.js`
- `src/utils/role.utils.js`
- `src/middleware/authorization.middleware.js`
- `src/middleware/permission.middleware.js`
- `src/routes/client.routes.js`
- role/permission-focused tests under `tests/` and `ui/tests/`

## Bugs found
1. Role checks were partially duplicated and could drift between exact string checks and rank-based intent.
2. Client-manage route guard used inline logic instead of shared role helper.
3. "Admin access required" copy could appear in flows where client-management capability is actually the required capability.

## Fixes applied
1. Centralized canonical firm role normalization + rank helpers on frontend and backend.
2. Updated frontend `requireClientManage` guard to use shared `canManageClients(user)`.
3. Hardened admin guard path in `ProtectedRoute` to explicitly treat PRIMARY_ADMIN as admin-or-above.
4. Preserved backend authoritative permission middleware (`authorizeFirmPermission('CLIENT_MANAGE')`) for client mutations and CFS endpoints.

## Tests added
- `tests/firmRoleHierarchy.helpers.test.js`
- `ui/tests/firmRoleHierarchy.permissions.test.mjs`

## Remaining known limitations
- Some legacy docs/tests still reference older phrasing/examples (informational only), but runtime guards now use centralized hierarchy helpers.


## 2026-05-10 Regression Follow-up: Client Creation Hierarchy
- **Missed stale check:** `ui/src/api/client.api.js` was still posting client mutations to `/api/admin/clients*`, which is mounted behind `requireAdmin`; this caused a stale admin-only gate path and could surface `Admin access required` even though client management is role/permission based.
- **Fix applied:** Switched client create/update/status/change-name mutations to `/api/clients*` endpoints that are consistently guarded by `authorizeFirmPermission('CLIENT_MANAGE')`.
- **Hierarchy correction:** Updated `src/services/authorization.service.js` so `MANAGER` inherits `CLIENT_VIEW` + `CLIENT_MANAGE`, and explicit per-user permission claims (e.g., `CLIENT_MANAGE` / `CLIENT_CREATE`) are merged into resolved firm permissions where present.
- **Regression tests added:**
  - `tests/clientCreateRoleHierarchy.regression.test.js`
  - `tests/authorization.service.explicitClientPermissions.test.js`
  - `ui/tests/clientsMessagingAndApiRoutes.test.mjs`
