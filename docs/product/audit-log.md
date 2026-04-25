# Audit Log (Firm Admin Explorer)

## Purpose

The firm **Audit Log** gives primary admins and authorized admins a firm-scoped visibility layer for high-impact admin activity.

This is an immutable read surface intended for trust, governance, and operational debugging.

## Who can view it

- **PRIMARY_ADMIN**
- **ADMIN/authorized admin users** with the `USER_VIEW` firm permission

Access is enforced by authenticated admin route guards and firm permission checks on `GET /api/admin/audit-logs`.

## What is logged

The explorer currently reads from `AdminAuditLog` events, including:

- user lifecycle events (`USER_INVITED`, `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_UNLOCKED`, `USER_PASSWORD_RESET`)
- role/hierarchy events (`ROLE_UPDATED`, `HIERARCHY_UPDATED`)
- admin configuration events (`WORKBENCH_CONFIG_UPDATED`, `CATEGORY_CONFIG_UPDATED`)

Each event is displayed with:

- readable summary
- timestamp
- actor
- action type
- module
- target entity
- severity/risk (when available)

## API

`GET /api/admin/audit-logs`

### Filters

- `actor` (ObjectId)
- `actionType` (action enum)
- `module`
- `startDate`, `endDate`
- `targetEntity`
- `severity`

### Pagination

- `page`
- `limit` (max 200)

Response shape:

- `data: AuditEntry[]`
- `pagination: { page, limit, total, totalPages, hasNextPage }`

## Tenant and data safety controls

- Strict firm scoping: every query is constrained by authenticated `firmId`.
- No cross-tenant data leakage in list responses.
- Sensitive metadata is redacted before returning entries (for example secrets/tokens/password-like fields and large object payloads).
- Full document contents are not returned by this explorer.

## UI location

- Firm workspace route: `/app/:firmSlug/admin/audit-logs`
- Surface: **Firm settings / admin audit log explorer**

