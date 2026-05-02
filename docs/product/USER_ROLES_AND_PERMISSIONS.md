# User Roles and Permissions

## Role hierarchy
`primary_admin > admin > manager > user`

Current UI navigation role filtering uses `USER`, `MANAGER`, `ADMIN`, `PRIMARY_ADMIN`; backend uses auth + permission middleware and tenant guards.

## Role definitions
### Superadmin
- Platform-wide operational role.
- Access to superadmin dashboard, firm management, diagnostics, onboarding insights.
- Must not access firm-scoped business data paths (CRM/CMS/dockets) in normal platform operations.

### Firm primary admin
- Highest role within a firm workspace.
- Full firm administration: users, settings, storage, reports, operational controls.

### Firm admin
- Administrative role for firm operations and team management.
- Access to CRM/CMS/admin/settings/reports along with work surfaces.

### Team member (manager/user)
- Execution-focused role for docket operations.
- Managers typically oversee allocation/supervision; users execute assigned/pulled dockets.

### Viewer/read-only
- **Not explicitly implemented as separate role in audited code paths.**
- Treat as future role requirement if introduced.

### Client/external user
- **Not currently implemented as first-class role** in audited route/permission model.
- Any external portal/user model is future scope unless explicitly implemented.

## Permission matrix (current expected behavior baseline)
Legend: `F` full, `L` limited, `N` none, `P` planned/future.

| Capability | Superadmin | Primary admin | Admin | Manager | User | Viewer (future) | Client/external (future) |
|---|---|---:|---:|---:|---:|---:|---:|
| Firm switch / platform control | F | N | N | N | N | N | N |
| CRM | N (firm-scoped business data) | F | F | L | N/L | P | P |
| CMS / intake | N (firm-scoped business data) | F | F | L | N/L | P | P |
| Dockets / tasks | N (firm-scoped business data) | F | F | F | L/F (assigned scope) | P | P |
| Settings | F (platform settings) | F | F | N/L | N | P | N |
| Storage/BYOS settings | F (platform diagnostics/policies) | F | L (per module permission contracts) | N | N | N | N |
| User/team management | F | F | F | N/L | N | N | N |
| Reports | F (cross-firm operations) | F | F | L | L | P | P |
| Diagnostics/audit tools | F | F/L (firm-level) | L (firm-level) | N/L | N | N | N |

## Notes and constraints

- Canonical enforcement roles are `PRIMARY_ADMIN`, `ADMIN`, `MANAGER`, `USER` (and `SUPER_ADMIN` for platform scope).
- Backward-compatibility input aliases are normalized at role utility/model boundaries only: `Admin -> ADMIN`, `Employee/Staff -> USER`, `SuperAdmin/SUPERADMIN -> SUPER_ADMIN`.
- These aliases are compatibility mapping only and must not introduce privilege escalation beyond their canonical mapped role.
- All role permissions are subordinate to tenant isolation; a high role in one firm does not grant access to another firm.
- Route-level UI access and API-level authorization must remain aligned; API always wins.
- If viewer/client roles are introduced, they require explicit backend permission contracts and tenant-safe test coverage.
