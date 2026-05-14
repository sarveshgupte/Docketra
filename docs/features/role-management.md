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
- **Manager** retains manager-level permissions (including client-management access where manager permissions are already enabled by policy).
- **Employee/User** remains regular staff access.
