# SuperAdmin Impersonation Boundary

## Current model
- SuperAdmin authentication is identity-backed and independent from firm-scoped tenant identity.
- Firm-scoped APIs resolve tenant context from authenticated tenant identity; SuperAdmin access to firm-scoped APIs is denied by boundary middleware.
- Client-sent impersonation headers are treated as untrusted input and validated server-side before any context attachment.

## Allowed and blocked routes
- Impersonation headers are suppressed by frontend API client for:
  - `/superadmin`, `/api/superadmin`
  - `/auth`, `/api/auth`
  - login/logout/refresh endpoints
  - public and health endpoints
- Firm-scoped backend routes reject SuperAdmin access (403) and do not allow tenant switching through client headers.

## Supported modes
- Accepted modes: `READ_ONLY`, `FULL_ACCESS`.
- Missing or invalid mode is fail-closed.
- `READ_ONLY` blocks mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).

## Expiry behavior
- Session/context validation requires both impersonated firm id and impersonation session id.
- Missing required fields fail closed.
- Expired/missing sessions are expected to be forbidden and never downgraded into normal firm auth context.

## Audit logging guarantees
- SuperAdmin impersonation lifecycle events are logged with safe metadata only.
- Required metadata: superadmin identity, target firm id, session id, route/method, mode, and denial reason when blocked.
- Sensitive payload content (docket content, attachments, OTPs, raw secrets, tokens, passwords) must not be included in audit metadata.

## Known limitations / deferred improvements
- SuperAdmin firm impersonation remains hard-disabled for firm-scoped access in current runtime guardrails.
- Session expiry persistence and server-side session store enforcement should remain validated in future enabling PRs before impersonation is reintroduced.
