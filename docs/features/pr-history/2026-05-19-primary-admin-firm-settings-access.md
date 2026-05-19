# Fixed PRIMARY_ADMIN authorization for firm admin configuration routes

## Summary
- Fixed firm-level permission resolution so PRIMARY_ADMIN aliases normalize correctly and receive expected firm-scoped permissions.
- Added explicit configuration permissions for firm settings and SLA rule management.
- Updated SLA and firm settings routes to authorize against configuration permissions (with ADMIN_STATS fallback for backward compatibility).
- Added deny-path logging context for permission middleware (requestId, userXID, role, requiredPermission, firmId).

## Impact
- Firm settings, SLA, categories/workbaskets, and admin activity endpoints now authorize PRIMARY_ADMIN consistently.
- False 403s on `/app/firm/:firmSlug/settings/firm` are resolved for PRIMARY_ADMIN sessions.
- Unauthorized non-admin users still receive 403 responses.

## Regression coverage
- Added middleware/permission regression tests for PRIMARY_ADMIN access on firm settings + SLA permissions and negative USER access.
