# Support Mode Hardening

## Support / Impersonation Headers
The backend now explicitly allows the following request headers for support-mode interoperability:
- `X-Impersonated-Firm-Id`
- `X-Impersonation-Session-Id`
- `X-Impersonation-Mode`

## Authorization Rules
These headers are only honored when request context is already authenticated as SuperAdmin/support context.
For non-superadmin users (including normal firm users), these headers are ignored and cannot override tenant context.
Unauthenticated requests cannot activate impersonation behavior.

## CORS / Preflight Requirements
Both CORS middleware configuration and explicit `OPTIONS` preflight responses include the support-mode headers in `Access-Control-Allow-Headers` so cross-origin support tooling can complete preflight.

## Debug Route Policy
- In production, `/api/auth/debug-cookie-state` returns `404` and is not available.
- Outside production, debug auth diagnostics require authentication.
- Debug routes must never expose sensitive operational/auth state publicly in production.

## Production Error Sanitization
For touched support/auth/debug flows, production responses must not return raw internal error details (`error.message`).
Detailed errors remain logged server-side; development/test behavior may retain detail where already standard.
