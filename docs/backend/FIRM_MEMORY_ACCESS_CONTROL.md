# Firm Memory Access Control

## Scope
Firm Memory surfaces include:
- `/api/clients`
- `/api/crm/clients`
- `/api/knowledge-items`
- `/api/leads`
- `/api/forms`
- `/api/deals`

## Role behavior
- **PRIMARY_ADMIN / ADMIN**: firm-wide read access (current behavior retained).
- **MANAGER / USER**: read access is client-scoped using `user.clientAccess` minus `user.restrictedClientIds`.
- **No resolved client scope** for MANAGER/USER: list endpoints return `200` with empty `data`.
- **SUPERADMIN**: blocked from tenant firm-memory endpoints.

## Fail-closed rules
- Missing firm context returns fail-closed (`400`/`403` depending on route guard).
- No manager/user scope never falls back to firm-wide data.

## Notes
This PR intentionally keeps existing Admin/Primary Admin firm-wide behavior and does not alter ownership split logic.
