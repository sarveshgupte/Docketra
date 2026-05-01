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
- Backend route used: `POST /superadmin/login`
- Cookie/session behavior:
  - Successful login sets auth cookies through shared auth session layer.
  - Existing stale firm slug hints are cleared for superadmin login context.
- Profile hydration: `GET /api/auth/profile`
- Post-login redirect: `/app/superadmin`

## 3) Forgot password
- UI routes:
  - `/forgot-password`
  - `/:firmSlug/forgot-password`
- API sequence:
  1. `POST /api/auth/forgot-password/init`
  2. `POST /api/auth/forgot-password/verify`
  3. `POST /api/auth/forgot-password/reset`

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
