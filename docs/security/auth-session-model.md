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
