# Tenant Identity Model (Canonical Runtime Scope)

## Canonical model

Docketra now treats the **default client `_id`** as the canonical runtime tenant identity.

- `User.firmId` (runtime auth scope) = default client `_id`.
- JWT `firmId` claim (runtime auth scope) = default client `_id`.
- `User.defaultClientId` = same default client `_id`.
- Tenant-scoped middleware and authorization checks use this runtime tenant id.

## Relational ownership model

Runtime scope and relational ownership are intentionally separated:

- `Firm._id` remains the ownership anchor for firm-owned relational data.
- `Client.firmId` continues to point at the owning `Firm._id` in firm-backed tenants.
- `Firm.defaultClientId` points to the default client used as runtime tenant/auth scope.

`Firm` remains metadata + ownership context (plan, subscription, lifecycle, onboarding metadata, slug lineage). It is not the runtime auth tenant root.

## Why this model

Each workspace already has an internal default client representing the organization. Making that ID canonical removes split-brain behavior where some flows used `Firm._id` and others used the default client `_id`.

## Backward compatibility and legacy fallback

Legacy users may still have `User.firmId = Firm._id`.

To keep those tenants working safely while migrations complete, runtime resolution now uses a central helper:

- `src/services/tenantIdentity.service.js`
  - `resolveCanonicalTenantFromFirmId(...)`
  - `resolveCanonicalTenantForUser(...)`
  - `resolveTenantBySlug(...)`

Fallback behavior:

1. If an incoming id is already a default client `_id`, use it as runtime tenant id.
2. If it is a legacy `Firm._id`, resolve runtime scope via `Firm.defaultClientId`.
3. For client ownership queries (`Client.firmId`), resolve to the ownership `Firm._id`.
4. If no default client can be resolved, fail closed or use explicit legacy path handling (depending on call-site) and log for remediation.

## Migration expectations

- New self-serve signup creates users with canonical runtime scope from day one (`User.firmId = default client _id`) while preserving `Client.firmId` ownership links to `Firm._id`.
- Existing legacy tenants can continue authenticating because auth middleware resolves legacy `Firm._id` to canonical tenant id before enforcing JWT/runtime checks.
- Any future backfill script should migrate legacy user rows from `Firm._id` to `Firm.defaultClientId` in controlled batches.

## Guardrails

- Cross-tenant checks are performed against canonical runtime tenant id, not raw legacy values.
- Firm-slug resolution for login APIs resolves to canonical runtime tenant id.
- Token and middleware context are normalized so downstream code receives a consistent tenant scope.
