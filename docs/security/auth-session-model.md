# Authentication Session Model

## Overview

Docketra now uses a **server-controlled cookie session model** for web authentication:

- `refreshToken` is stored only in an **HttpOnly** cookie.
- `accessToken` is also set as an **HttpOnly** cookie for authenticated API access.
- Tokens are **not** persisted in `localStorage` or `sessionStorage`.
- Refresh tokens are **never returned in JSON** responses.

This reduces token theft risk from XSS and keeps session state under backend control.

## Cookie Configuration

For auth cookies (`accessToken`, `refreshToken`):

- `httpOnly: true`
- `secure: true` in production
- `sameSite: 'lax'`
- `path: '/'`

`accessToken` has short TTL (~15 minutes).  
`refreshToken` uses configured refresh expiry and is rotated on refresh.

## Token Lifecycle

### Login (`/api/auth/login/verify`, `/api/auth/complete-mfa-login`, superadmin login)
1. Credentials/OTP are validated.
2. Backend issues access + refresh tokens.
3. Tokens are set via HttpOnly cookies.
4. Response JSON returns only session/user metadata (no tokens).

### Refresh (`/api/auth/refresh`)
1. Backend reads refresh token from cookie.
2. Validates token hash, status, expiry, and user state.
3. Revokes current refresh token and rotates to a new refresh token.
4. Sets new auth cookies and returns success metadata only.

### Logout (`/api/auth/logout`)
1. Backend revokes active refresh tokens for the user (where applicable).
2. Backend clears auth cookies explicitly.
3. Frontend clears in-memory auth state.

## CSRF Controls

Because cookies are used for auth, Docketra applies:

- `SameSite=Lax` on auth cookies.
- Origin/referrer same-origin enforcement on sensitive cookie-backed auth routes (`/auth/refresh`, `/auth/logout`).

For future high-risk mutations, reuse the same origin validation middleware or add CSRF tokens if cross-site form POST is introduced.

## Frontend Client Behavior

- Axios uses `withCredentials: true`.
- No Authorization header is injected by the frontend API client.
- On `401`, client attempts `/auth/refresh` and retries once.
- If refresh fails, client clears local auth state and redirects to login.
- Client auth truth comes from `AuthContext` + `/api/auth/profile` hydration, not token presence checks.

## Standardization Notes

- Backend API authentication middleware reads access token from cookies only.
- Socket authentication reads `accessToken` from handshake cookies only.
- Auth router enforces origin/referrer CSRF checks on all state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- Deprecated client auth token helpers have been removed from runtime usage (no `isAuthenticated()` token shim in `authService`).

## April 2026 hotfix — auth refresh loop prevention

### Root cause

- A CSRF same-origin guard compared `Origin`/`Referer` host to `Host` too literally.
- In production, frontend and API can be on different legitimate hosts (`app.*` vs `api.*`), so valid refresh requests were rejected with `403`.
- Frontend hydration then hit `GET /api/auth/profile` (`401`) → `POST /api/auth/refresh` (`403`) repeatedly, and hard redirects to login could re-trigger the cycle.

### What was fixed

- CSRF middleware now accepts:
  - direct same-host requests, including `X-Forwarded-Host` aware checks behind reverse proxies,
  - configured frontend origins from `FRONTEND_ORIGINS` / `FRONTEND_URL`.
- Refresh/session service now emits lightweight logs for refresh rejection reasons (missing cookie, invalid/expired, revoked, unsupported scope, inactive user).
- Frontend API interceptor now has explicit loop guards:
  - never refresh recursively when `/auth/refresh` itself returns `401`,
  - short-circuit additional refresh attempts after a refresh failure in the same app lifecycle,
  - skip hard redirect if already on a login route.
- Auth bootstrap (`AuthContext`) now marks resolved unauthenticated state after refresh/profile auth failure and short-circuits repeated hydration retries until a successful login.

### How refresh failure is now handled

1. Profile fetch gets `401`.
2. Client attempts **one** refresh for that failed request.
3. If refresh fails, auth is resolved as unauthenticated, local auth hints are cleared, and login redirect is performed once (without self-redirect thrash).
4. Further profile hydration retries are blocked until next explicit login success.

### Why repeated loops are prevented now

- Backend no longer incorrectly rejects legitimate deployed frontend refresh calls because of host mismatch alone.
- Frontend cannot recursively refresh refresh calls.
- Frontend cannot repeatedly hard-redirect to the same login page.
- AuthContext blocks re-hydration loops once unauthenticated state has already been resolved.


## Pilot support diagnostics update (2026-04-23)
- Refresh responses include machine-readable reason codes for support triage (`missing_refresh_token`, `refresh_not_supported`).
- Refresh outcomes now emit structured pilot-ops events without logging sensitive tokens.

## April 24, 2026 hardening addendum

### Mutating-route origin/CSRF consistency
- Same-origin validation is now enforced centrally for mutating routes (`POST`/`PUT`/`PATCH`/`DELETE`) that carry cookie-auth context.
- Auth router keeps route-local protection as defense in depth.
- Internal/token-auth and operational endpoints (health/metrics/CSP reporting) are explicitly excluded from cookie CSRF enforcement to avoid blocking non-browser integrations.

### Cookie hardening details
- Auth cookies remain `httpOnly` and `secure` in production.
- `sameSite` defaults to `lax` and can be overridden with `AUTH_COOKIE_SAMESITE`.
- `AUTH_COOKIE_DOMAIN` can be used for controlled multi-subdomain deployments.

### Logout/session invalidation behavior
- Logout revokes refresh tokens and disconnects active authenticated websocket sessions for the same user and firm.
- Invalid/revoked refresh attempts now clear auth cookies to avoid stale-cookie retry loops.
- Missing refresh token / unsupported scope / inactive user refresh rejections now also clear auth cookies for consistent stale-session cleanup.

### Frontend auth state + cache lifecycle
- Auth reset/logout clears React Query cache so private data does not persist after session end.
- Logout is broadcast across tabs via localStorage key updates.
- Browser clients emit a logout lifecycle event used by socket consumers to disconnect immediately.
- Logout broadcast writes are best-effort with guarded storage access, so local logout finalization still succeeds in restricted storage environments.

## April 24, 2026 auth-flow regression fix

### SuperAdmin login contract
- SuperAdmin login remains cookie-based and does **not** require firm context.
- SuperAdmin login/profile responses now include `redirectTo: /app/superadmin` for deterministic frontend routing.
- SuperAdmin sessions continue to advertise `refreshEnabled: false`, and frontend route resolution must not assume `firmSlug`.

### Firm login + OTP verify contract
- Tenant login OTP verify responses now include `redirectTo` derived from `firmSlug` (`/app/firm/:firmSlug/dashboard`).
- Frontend OTP success handlers force profile hydration once (`fetchProfile({ force: true })`) to clear stale unauthenticated guards and avoid post-OTP blank states.
- Public auth endpoints (`/auth/login/*`, `/auth/forgot-password/*`) are explicitly marked as non-refreshable in API interceptor logic to prevent accidental refresh recursion on expected auth errors.

### Forgot-password firmSlug handling
- Forgot-password OTP routes now use optional firm resolution middleware:
  - If `firmSlug` is present, firm scope is enforced.
  - If absent, backend resolves a unique active account safely without account enumeration.
- `forgot-password/init`, `verify`, and `reset` include `firmSlug` in success payloads when resolved, so frontend can preserve workspace login context end-to-end.

### Logout/session expectations
- Logout continues to clear auth cookies server-side and clear client cache/state + broadcast logout across tabs.
- `preserveFirmSlug` behavior remains best-effort and only preserves routing hints, not identity material.
