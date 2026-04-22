# Tenant Isolation and Permission Enforcement

## 0) Scope shipped in this hardening pass
- Admin polish fixes:
  - high-risk admin user actions now use app-consistent confirmation modal UX,
  - canonical admin-facing role labels are standardized (`Primary Admin`, `Admin`, `Manager`, `Employee`, `Partner`),
  - `SuperAdmin` remains platform-only and outside firm admin flows.
- Tenant-boundary hardening:
  - firm-scoped report routes now fail closed without tenant context,
  - `SuperAdmin` is explicitly denied on firm-scoped reports endpoints.

## 1) Tenant boundary rules
- All firm-scoped resources must be fetched/mutated with server-side tenant context (`firmId`) derived from authenticated request context.
- Resource lookups must include tenant constraints (for example: `_id + firmId`, `xID + firmId`, `clientId + firmId`).
- Missing tenant context must fail closed (`403`) instead of defaulting to global access.
- Cross-firm access attempts must not disclose existence of another tenant's resource.

## 2) Server-side enforcement principles
- Frontend permissions are UX hints only; backend authorization is authoritative.
- Tenant-scoped routes require authenticated context and invariant guardrails.
- Role checks must use canonical role normalization utilities to avoid alias drift.
- Mutations on high-risk entities (users, client access, hierarchy) require explicit role and ownership checks.

## 3) SuperAdmin exception rules
- SuperAdmin is a platform-only role.
- SuperAdmin must not access firm-scoped reporting/admin endpoints intended for tenant operations.
- SuperAdmin behavior is explicitly isolated to platform routes and controls.

## 4) Critical protected resource types
- User management: invite, activate/deactivate, unlock, password reset, hierarchy updates.
- Client management: list/detail/update and access restrictions.
- Dockets: list/detail/update, assignment, queue/worklist/QC flows.
- Reports: firm-scoped analytics, exports, and audit feeds.
- Settings/admin actions: firm/work settings and other firm governance mutations.

## 5) Safe vs unsafe access patterns

### Safe patterns
- `User.findOne({ _id: id, firmId: req.user.firmId, status: { $ne: 'deleted' } })`
- `Case.find({ firmId: tenantId, ...filters })`
- Resolve tenant id from authenticated context and block when absent.

### Unsafe patterns
- `Model.findById(id)` on tenant data without tenant filter.
- Trusting route/query firm identifiers from UI without server verification.
- Accepting legacy role aliases in ad hoc string checks instead of centralized normalization.

## 6) Regression coverage added in this PR
- Reports controller tests now verify:
  - missing tenant context is denied (`403`),
  - SuperAdmin is blocked from firm-scoped report routes,
  - standard tenant-admin access still succeeds.
- Admin surface tests now verify:
  - high-risk user actions use shared confirmation modal UX,
  - native `window.confirm` is not used for these actions,
  - canonical role hierarchy copy uses `Employee` labels in admin UI support copy.
