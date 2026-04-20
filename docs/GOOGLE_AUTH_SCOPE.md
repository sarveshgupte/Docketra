# Google Auth Scope in Docketra

## Status (April 20, 2026)

Google OAuth is now **restricted to BYOS storage connection only**.

- **Removed:** Google OAuth for public **sign in / sign up**.
- **Kept:** Google OAuth for **Google Drive BYOS** connection and token refresh.

## What was removed

### Retired auth routes (user login/signup)

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/exchange`

### Retired frontend auth flow

- `/oauth/post-auth` public route
- `OAuthPostAuthPage`
- Google login CTA on firm login page
- Google signup CTA on setup-password page

## What remains active (BYOS)

These routes/services still power Google Drive integration for storage:

### Active storage routes

- `GET /api/storage/google/connect`
- `GET /api/storage/google/callback`
- `POST /api/storage/google/confirm-drive`

### Active backend services and controllers

- `src/controllers/storage.controller.js`
- `src/services/googleDrive.service.js`
- storage provider wiring under `src/services/storage/**`

### Active frontend entry points

- Storage settings UI connect/refresh actions
- `ui/src/services/storageService.js` (connect redirect)

## Environment variables

### Still required for Google Drive BYOS

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

### No longer used for login/signup OAuth

- `GOOGLE_AUTH_REDIRECT_URI`
- `GOOGLE_CALLBACK_URL`
- `DISABLE_GOOGLE_AUTH`
- `VITE_ENABLE_GOOGLE_LOGIN`
- `VITE_GOOGLE_CLIENT_ID`

## Contributor guidance

When changing auth, keep the boundary explicit:

1. **User authentication** is xID/password + OTP flows (no Google login).
2. **Google OAuth** is only for Drive authorization in BYOS storage settings.
3. Do not reintroduce login/signup Google CTAs or `/api/auth/google/*` routes without a product/security review.
