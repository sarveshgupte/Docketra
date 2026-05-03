# Access Control Split: PRIMARY_ADMIN vs ADMIN

## PRIMARY_ADMIN (owner/security scope)
- Role/hierarchy power mutations (activation, role/admin authority, hierarchy authority-impacting changes, restricted-client power changes).
- Storage ownership controls (connect/change/disconnect provider, credential-affecting updates/tests).
- AI ownership controls (provider/model updates, API key/credential updates, provider tests).
- Sensitive firm settings mutations (owner/security/retention/audit-adjacent writes, intake API key regeneration).

## ADMIN (operational scope)
- Team & Access read endpoints (`/api/admin/stats`, `/api/admin/users`, `/api/admin/workbaskets`, `/api/admin/hierarchy`).
- Operational administration that does not mutate owner/security secrets or firm ownership controls.
- Masked read access to storage/AI configuration where route policy allows (`GET /api/storage/configuration`, `GET /api/ai/configuration`).

## Guard behavior
- Admin users invoking PRIMARY_ADMIN-only controls receive `403` with message: `Primary admin access required`.
- Missing firm context remains fail-closed through existing tenant guards/middleware.
