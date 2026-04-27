# Auth & Session Troubleshooting (Render Production)

## Symptoms this guide addresses
- Login returns `200`, but the next `GET /api/auth/profile` returns `401`.
- `POST /api/auth/refresh` immediately returns `401` with missing refresh cookie.
- Superadmin login shows a workspace-context error even though credentials are valid.

## Required production cookie behavior
For both tenant users and superadmin users:
- Backend must set **both** `accessToken` and `refreshToken` cookies on successful login.
- Cookies must be `HttpOnly`.
- Cookies must be `Secure` in production.
- `SameSite` defaults to `lax`.
- Set `AUTH_COOKIE_CROSS_SITE=true` (or `AUTH_COOKIE_SAMESITE=none`) for cross-origin Render deployments (separate frontend/backend hosts).
- Cookie `path` must be `/`.
- Avoid setting `AUTH_COOKIE_DOMAIN` to Render hostnames (`*.onrender.com`) or invalid values with protocol/port.
  - On Render, host-only cookies are the safest default.

## Render-specific domain guidance
If your frontend and API are on different Render hostnames:
- Keep `AUTH_COOKIE_DOMAIN` unset.
- Use CORS allowlist for exact frontend origin(s).
- Ensure frontend requests use credentials (`withCredentials: true` / `credentials: 'include'`).

## Expected auth flow: superadmin
1. `POST /api/superadmin/login` validates credentials.
2. Backend sets `accessToken` + `refreshToken` cookies.
3. Refresh token is stored with explicit `scope: superadmin` (not inferred from null IDs).
4. Frontend loads `GET /api/auth/profile`.
5. Profile returns superadmin virtual profile (`firmId: null`, `isSuperAdmin: true`).
6. Frontend redirects to `/app/superadmin`.

Superadmin must **not** require firm/workspace context.

## Expected auth flow: firm/workspace user
1. Login + OTP verification (if enabled).
2. Backend sets `accessToken` + `refreshToken` cookies.
3. Refresh token is stored with explicit `scope: tenant` and must include both `userId` + `firmId`.
4. Frontend calls `GET /api/auth/profile`.
5. Profile returns user + firm context.
6. Frontend redirects to firm dashboard route.

## Refresh token scope/type rules
- Superadmin refresh is allowed only when refresh token has explicit `scope: superadmin`.
- A token with `userId: null` and `firmId: null` but without explicit `scope: superadmin` is rejected.
- Tenant refresh requires `scope: tenant` (or legacy token with valid user+firm IDs) and both `userId` + `firmId`.

## Safe diagnostics in production
- Log only booleans/meta for cookies (for example: `attemptedRefreshCookie: true`).
- Do not log token values.
- Do not log full user objects with PII in production.
- Do not log email/xID for auth refresh diagnostics.

## Frontend credential requirements
- All auth-sensitive calls must use shared credential-aware Axios client (`withCredentials: true`):
  - login / login-verify (OTP),
  - profile,
  - refresh,
  - logout,
  - forgot/reset endpoints that rely on session cookies.

## Quick verification checklist
1. Login response has `Set-Cookie` headers for both auth cookies.
2. Browser stores both cookies for the API origin.
3. Next `GET /api/auth/profile` returns `200`.
4. `POST /api/auth/refresh` returns `200` when cookies are present.
5. Superadmin route lands on `/app/superadmin` without workspace errors.
