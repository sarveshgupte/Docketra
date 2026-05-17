# Role Management (Firm Scope)

## Canonical hierarchy

`PRIMARY_ADMIN > ADMIN > MANAGER > USER (Employee)`

## Primary Admin

- Each firm has exactly one **Primary Admin** account.
- Primary Admin is a firm-owner role and is **not assignable** through Team Management invite/edit/bulk flows.
- Operationally, firms may use a common firm-controlled mailbox for this account (for example: `admin@firm.com`) to reduce ownership risk during staffing changes.

## Assignable Team Management roles

Team Management supports these assignable roles only:

- **Admin**
- **Manager**
- **Employee** (stored canonically as `USER`)

## Access inheritance

- **Admin** inherits Manager-level access.
- **Primary Admin** inherits Admin and Manager-level access.
- **Manager** has manager-level access for workbaskets, assigned QC workbaskets, worklists, and reports. Manager does not get Client Management or Team Management by default.
- **Employee/User** remains regular staff access.


## Team Management hardening (2026-05)
- Assignable roles are strictly Admin, Manager, Employee (mapped to USER backend canonical).
- Primary Admin is not assignable in Team Management and remains single-per-firm.
- SuperAdmin is platform-only and excluded from firm role hierarchy and assignment.
- Admin/Primary Admin can manage team settings; Manager/Employee cannot.
- Workbasket/QC visibility remains assignment-aware for non-admin roles.

### Team Management client access controls
- Primary Admin and Admin can manage user client access from Team Management.
- Access modes: **All clients** or **Selected clients only**.
- Primary Admin users remain protected from normal restriction edits.

## Work Management access (manager-and-above)
- Allowed: `PRIMARY_ADMIN`, `ADMIN`, `MANAGER`.
- Denied: `USER` (Employee) and `SUPER_ADMIN` on firm-scoped Work Management routes.
- Work Management governs workflow structure (categories/subcategories/workbaskets + routing); user assignment to workbaskets/QC remains Team Management-owned.


### Work Management access and WB/QC linkage (May 2026)
- Work Management is available to `PRIMARY_ADMIN`, `ADMIN`, and `MANAGER`.
- Employee/User roles are denied Work Management route and mutations.
- Primary Workbasket creation enforces automatic creation of one linked QC Workbasket (`${primaryWorkbasketName} — QC`).
- Team Management owns WB/QC user assignment boundaries.
