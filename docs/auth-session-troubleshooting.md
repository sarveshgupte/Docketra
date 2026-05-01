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
- `SameSite` defaults to `lax` only for same-origin deployments.
- Set `AUTH_COOKIE_CROSS_SITE=true` (or `AUTH_COOKIE_SAMESITE=none`) for cross-origin Render deployments (separate frontend/backend hosts).
- Cookie `path` must be `/`.
- Avoid setting `AUTH_COOKIE_DOMAIN` to Render hostnames (`*.onrender.com`) or invalid values with protocol/port.
  - On Render, host-only cookies are the safest default.

## Render-specific domain guidance
If your frontend and API are on different Render hostnames:
- Keep `AUTH_COOKIE_DOMAIN` unset.
- Use CORS allowlist for exact frontend origin(s).
- Ensure frontend requests use credentials (`withCredentials: true` / `credentials: 'include'`).
- Required envs for cross-origin Render:
  - `AUTH_COOKIE_CROSS_SITE=true`
  - `AUTH_COOKIE_DOMAIN` **unset**
  - `FRONTEND_ORIGINS=https://<your-frontend-host>`
  - (recommended) `API_PUBLIC_ORIGIN=https://<your-api-host>` for startup misconfiguration warnings.

At backend startup, verify:
- `AUTH_COOKIE_CONFIG_RESOLVED` log includes `sameSite`, `secure`, `domainPresent`, `crossSiteEnabled`.
- If frontend/API origins are cross-origin and `sameSite=lax`, backend emits `AUTH_COOKIE_CROSS_ORIGIN_MISCONFIG`.

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

### Tenant context requirement
- `defaultClientId` is **mandatory** for tenant workspace bootstrapping.
- If profile cannot resolve/create a valid default client, `GET /api/auth/profile` returns `503` with `code=DEFAULT_CLIENT_CONTEXT_UNAVAILABLE`.
- This is intentional fail-closed behavior to prevent downstream docket/client/task flows from booting with broken tenant context.

## Refresh token scope/type rules
- Superadmin refresh is allowed only when refresh token has explicit `scope: superadmin`.
- A token with `userId: null` and `firmId: null` but without explicit `scope: superadmin` is rejected.
- Tenant refresh requires `scope: tenant` (or legacy token with valid user+firm IDs) and both `userId` + `firmId`.

## Safe diagnostics in production
- Log only booleans/meta for cookies (for example: `attemptedRefreshCookie: true`).
- Do not log token values.
- Do not log full user objects with PII in production.
- Do not log email/xID for auth refresh diagnostics.
- Optional gated endpoint: `GET /api/auth/debug-cookie-state` when `AUTH_DEBUG_DIAGNOSTICS=true`.
  - Returns safe metadata only:
    - `hasCookieHeader`, `hasAccessTokenCookie`, `hasRefreshTokenCookie`
    - `cookieNames` (names only)
    - request origin/host/forwarded host/proto
    - computed cookie options (`sameSite`, `secure`, `domainPresent`, `path`, `crossSiteEnabled`)
  - Disabled by default and responds `404` when diagnostics mode is off.

## Frontend credential requirements
- All auth-sensitive calls must use shared credential-aware Axios client (`withCredentials: true`):
  - login / login-verify (OTP),
  - profile,
  - refresh,
  - logout,
  - forgot/reset endpoints that rely on session cookies.

## Manual QA script (production-ready)

### Superadmin flow
1. Clear cookies/storage for frontend + API origins.
2. Open `/superadmin` (or `/superadmin/login`).
3. Submit valid superadmin credentials.
4. In DevTools **Network** login response:
   - verify `Set-Cookie` for `accessToken`
   - verify `Set-Cookie` for `refreshToken`
5. Call `GET /api/auth/profile` and verify:
   - HTTP `200`
   - `isSuperAdmin=true`
   - `firmId=null`, `firmSlug=null`
6. Call `GET /api/superadmin/stats` and verify `200`.
7. Trigger logout (`POST /api/auth/logout`) and verify both cookies are cleared.

### Tenant firm-slug OTP flow
1. Clear cookies/storage.
2. Open `/:firmSlug/login` (example `/gupte-opc/login`).
3. Verify firm lookup success from `/api/public/firms/:firmSlug`.
4. Submit login init and verify OTP challenge response.
5. Complete OTP verify and check response sets both auth cookies.
6. Call `GET /api/auth/profile` and verify `200` with tenant context:
   - `firmId` (Mongo id)
   - `firmCode` (display id)
   - `firmSlug`
   - `defaultClientId` (if available)
7. Refresh page and verify session persists.
8. Logout and verify cookies are cleared.

### Forgot-password (tenant) flow
1. From `/:firmSlug/login`, open forgot-password page.
2. Start reset (`forgot-password/init`) using email/xID.
3. Verify response is non-enumerating (safe generic messaging).
4. Complete OTP verify + reset.
5. Login with the new password and confirm success.
6. Validate existing sessions are revoked (old refresh token no longer works).

## Known auth limitations / explicit behavior
- Superadmin forgot-password is not handled via tenant OTP reset flow; treat as controlled/admin-operated credential rotation.
- Canonical tenant redirect after successful tenant auth/profile hydration is `/app/firm/:firmSlug/dashboard`.
- `AUTH_DEBUG_DIAGNOSTICS` should be set to `true` only during active troubleshooting; reset to `false` (or unset) immediately after verification.
