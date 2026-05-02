# Auth middleware execution contract

## `authenticate` is allowed to do

- Read request token from cookie or bearer header.
- Verify JWT signature and expiry.
- Load the user from MongoDB and enforce active-account/password-setup checks.
- Resolve canonical tenant context (`tenantId`, `defaultClientId`, `firmSlug`) for runtime authorization context.
- Fail closed if tenant/default-client context is missing or inconsistent for non-superadmin users.
- Attach normalized auth context to `req.user`, `req.jwt`, `req.identity`, and `req.context`.
- Emit non-blocking auth telemetry/logging.

## `authenticate` must remain read-only

During normal protected route access, `authenticate` must not mutate business records:

- no `user.save()` calls
- no default-client creation/repair
- no tenant or firm mutation
- no implicit account self-healing writes

Only non-blocking security telemetry side effects are permitted.

## Where repair/mutation is allowed

Tenant/default-client/account invariant repair is allowed only in explicit mutation paths, such as:

- login/session issuance flows (before issuing JWT claims)
- bootstrap/admin repair flows
- clearly named repair services invoked by explicit repair operations

This keeps protected route middleware deterministic, faster, and read-only.

## Tenant context propagation

After successful auth:

- `req.user` carries normalized identity/role plus runtime tenant fields.
- `req.jwt` carries canonical JWT authorization claims (`firmId`, `firmSlug`, `defaultClientId`, `role`).
- `req.identity` carries canonical `{ userId, firmId, role }`.
- downstream tenant middleware should reuse this context rather than recomputing tenant identity.

Superadmin remains platform-scope only (`firmId/defaultClientId = null`) and must still be blocked from firm-scoped routes by downstream boundary middleware.

## `authTenantContext` reuse contract (performance + isolation)

`authenticate` now attaches an immutable `req.authTenantContext` snapshot with canonical tenant fields:

- `tenantId`
- `defaultClientId`
- `firmSlug`
- `ownershipFirmId`
- `legacyFirmId`
- `status`

`firmContext` may reuse this snapshot only when all of the following are true:

- caller is not superadmin
- `req.jwt.firmId` is present, valid, and matches `authTenantContext.tenantId`
- tenant status is active
- ownership context (`ownershipFirmId`) is present

If any guard fails, `firmContext` resolves tenant identity again (or fails closed on mismatch/missing context). This keeps tenant boundary behavior unchanged while avoiding duplicate canonical lookups for valid, already-authenticated tenant requests.
