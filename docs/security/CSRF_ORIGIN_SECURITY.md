# CSRF Origin Enforcement Security Contract

## Purpose
Protect cookie-authenticated mutating endpoints from cross-site request forgery by enforcing same-origin checks for browser-style requests.

## Enforcement scope
`src/middleware/csrfOrigin.middleware.js` enforces checks only for mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) and only when auth cookies (`accessToken` or `refreshToken`) are present.

Requests that use bearer/internal headers without cookies are intentionally allowed so internal and service-to-service flows are not blocked.

## Production missing-origin rule
In `NODE_ENV=production`, cookie-authenticated mutating requests must include at least one valid browser provenance header:
- `Origin`, or
- `Referer`

If **both headers are missing**, the request is rejected with `403 Invalid request origin`.

In non-production environments (`development` and `test`), missing `Origin` and `Referer` remain allowed to preserve local tooling and regression test behavior.

## Skip paths
The middleware explicitly skips enforcement for:
- health endpoints (`/health`, `/api/health`, `/api/system/health`)
- metrics endpoints (`/metrics`, `/api/metrics/security`)
- CSP report ingestion (`/api/csp-violation`)

These skips remain active in production to avoid breaking platform health and observability traffic.

## Regression coverage
`tests/csrfOrigin.middleware.test.js` covers:
- valid cookie-auth origin pass
- invalid cookie-auth origin reject
- production cookie-auth missing origin/referer reject
- bearer-token request with no cookies and no origin/referer pass
- skip paths for health/metrics/CSP pass
