# SuperAdmin Impersonation Boundary

## Current model
- SuperAdmin authentication is identity-backed and independent from firm-scoped tenant identity.
- Firm-scoped APIs resolve tenant context from authenticated tenant identity; SuperAdmin access to firm-scoped APIs is denied by boundary middleware.
- Client-sent impersonation headers are treated as untrusted input.

## Current enforcement status
- Server-side impersonation session persistence/validation is not implemented in current runtime.
- Therefore impersonation headers are fail-closed: when a SuperAdmin sends impersonation headers, backend rejects the request with `403` and does not attach impersonated firm/session context.
- Normal firm users cannot activate impersonation behavior via headers.

## Allowed and blocked routes
- Frontend suppresses impersonation headers for:
  - `/superadmin`, `/api/superadmin`
  - `/auth`, `/api/auth`
  - login/logout/refresh endpoints
  - public and health endpoints
- Firm-scoped backend routes reject SuperAdmin access (403) and do not allow tenant switching through client headers.

## Supported modes
- Header values may include `READ_ONLY` / `FULL_ACCESS`, but mode does not grant access while impersonation is globally fail-closed.

## Expiry and revocation behavior
- Because session persistence is not active, requests are denied before session matching/expiry/revocation checks.
- No request is downgraded into normal firm auth when impersonation headers are present.

## Audit logging guarantees
- SuperAdmin impersonation lifecycle endpoints remain audit logged.
- Denied requests should include only safe metadata (identity, firm/session identifiers, route/method, denial reason).
- Sensitive payload content (docket content, attachments, OTPs, raw secrets, tokens, passwords) must not be logged.

## Deferred improvements
- Implement server-side impersonation session store and enforce all of:
  - session existence
  - session owner (SuperAdmin)
  - firm/session match
  - expiry/revocation
  - mode constraints for mutating methods
