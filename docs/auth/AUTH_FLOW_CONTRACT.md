# Docketra Authentication Flow Contract

## Purpose
This document defines the canonical authentication flows currently used by active Docketra UI surfaces and their backend route contract.

## Canonical base path
- UI calls `/auth/*`.
- Backend exposes the same handlers under `/api/auth/*` and `/auth/*` mounts.

## 1) Firm user login
- UI route: `/:firmSlug/login`
- API sequence:
  1. `POST /api/auth/login/init`
  2. `POST /api/auth/login/verify`
  3. `GET /api/auth/profile`
- Post-login redirect: `/app/firm/:firmSlug/dashboard`
- Notes:
  - `firmSlug` is passed in request body for login init/verify.
  - Pending login token is held in session storage until verify succeeds.

## 2) Superadmin login
- UI route: `/superadmin/login` (also `/superadmin` route renders same login screen)
- Backend routes: `POST /superadmin/login` and `POST /api/superadmin/login` (same handler).
- Cookie/session behavior:
  - Successful login sets `accessToken` + `refreshToken` via shared `setAuthCookies` (HTTP-only, secure/sameSite/domain/path aligned with tenant flow).
  - Existing stale firm/workspace hints are cleared (`localStorage.firmSlug`, pending login session keys).
- Profile hydration: `GET /api/auth/profile` immediately resolves a virtual superadmin identity (`firmId=null`, `firmSlug=null`).
- Refresh behavior: `POST /api/auth/refresh` supports superadmin-scope refresh tokens and rotates cookies. If server config cannot mint superadmin identity, response is `401` with `code=REFRESH_NOT_SUPPORTED` and `reasonCode=REFRESH_NOT_SUPPORTED`.
- Post-login redirect: `/app/superadmin`

## 3) Forgot password
- UI routes:
  - `/forgot-password`
  - `/:firmSlug/forgot-password`
- API sequence:
  1. `POST /api/auth/forgot-password/init`
  2. `POST /api/auth/forgot-password/verify`
  3. `POST /api/auth/forgot-password/reset`
- Security/tenant contract:
  - `init` accepts either email or xID, with optional `firmSlug`.
  - When `firmSlug` is present, lookup + OTP/reset operations are scoped to that tenant only.
  - `init` returns a generic success message for unknown/ambiguous identifiers to prevent tenant/account enumeration.
  - `verify` and `reset` reject cross-tenant, invalid, expired, reused, or locked credentials.
  - Successful reset clears OTP/reset state so old OTPs/tokens cannot be reused.
  - Backend may return `firmSlug` in success payloads so global `/forgot-password` can preserve login context.

## 4) Signup
- UI route: `/signup`
- API sequence:
  1. `POST /api/auth/signup/init`
  2. `POST /api/auth/signup/verify`
- Redirect behavior:
  - After verify, profile is fetched and navigation resolves by role + firm context.
  - Expected workspace landing for firm users is firm app namespace (`/app/firm/:firmSlug/...`).

## 5) Logout
- API route: `POST /api/auth/logout`
- Server contract: clears both auth cookies (`accessToken`, `refreshToken`) using shared auth cookie options.
- Client contract:
  - Clears pending login state from session storage.
  - Firm slug preservation is context-driven:
    - preserve when logging out but staying in the same firm workspace context.
    - clear when exiting workspace context (e.g. superadmin/auth boundary transitions).

## Route redirects and legacy route compatibility
- `/app/:firmSlug/login` redirects to `/:firmSlug/login`.
- `/app/:firmSlug/forgot-password` redirects to `/:firmSlug/forgot-password`.

## Legacy auth endpoints intentionally retained (non-canonical)
These are retained for backward compatibility and/or non-login OTP flows. Active login/signup/forgot-password flows must not be built on top of these:
- `POST /api/auth/forgot-password` (legacy reset-init entrypoint)
- `POST /api/auth/send-otp` (legacy generic OTP send)
- `POST /api/auth/verify-otp` (legacy generic OTP verify)
- `POST /api/auth/resend-otp` (legacy generic OTP resend)

### Explicit retain reason
- `send-otp` and `verify-otp` are still used by storage provider change step-up OTP flow in frontend service code.
- Remaining legacy endpoints stay available until removal is proven safe by usage and regression coverage.
