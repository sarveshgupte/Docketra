# Production Environment Security Gate

This document defines required backend environment configuration for Render production deployments.

## Required in production (Render backend)

- `NODE_ENV=production`
- `MONGO_URI` (or `MONGODB_URI`)
- `REDIS_URL`
- `JWT_SECRET` (strong random, >=64 chars)
- `JWT_PASSWORD_SETUP_SECRET` (strong random, >=64 chars)
- `MASTER_ENCRYPTION_KEY` (**44-char base64** for 32 bytes, or **64-char hex**)
- `STORAGE_TOKEN_SECRET` (strong random, >=64 chars)
- `METRICS_TOKEN` (strong random, >=64 chars)
- `SUPERADMIN_PASSWORD_HASH` (bcrypt hash)
- `SUPERADMIN_OBJECT_ID` (Mongo ObjectId)
- `SUPERADMIN_EMAIL`
- `UPLOAD_SCAN_STRICT=true`
- `AUTH_DEBUG_DIAGNOSTICS=false`
- `BREVO_API_KEY`
- `MAIL_FROM` or `SMTP_FROM`
- `SMTP_PASS` when SMTP transport is used (`SMTP_FROM` set)

## Conditional Google/BYOS requirements

Google storage OAuth (BYOS/external storage) uses:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` (storage OAuth callback)

These are enforced only when `ENABLE_EXTERNAL_STORAGE=true`.
`DISABLE_GOOGLE_AUTH` does not control BYOS storage validation.

Google login/auth is separate from Google Drive BYOS storage.

Note on callback naming:
- `GOOGLE_AUTH_REDIRECT_URI` / `GOOGLE_CALLBACK_URL` are login/auth callback aliases.
- `GOOGLE_OAUTH_REDIRECT_URI` is the storage/BYOS OAuth callback used by storage providers.

## Why strict gates exist

- `AUTH_DEBUG_DIAGNOSTICS=false` prevents production auth/session diagnostics exposure.
- `UPLOAD_SCAN_STRICT=true` ensures upload scanning is fail-closed in production flows.
- `REDIS_URL` is required in production for distributed abuse and rate-limit controls.

## CLAMAV rollout note

`CLAMAV_HOST` is not startup-required yet in this phase.
Before public launch, scanning infrastructure (ClamAV or equivalent) must be configured and verified.

## Render frontend/backend URL alignment

For split Render services:
- `FRONTEND_URL` / `FRONTEND_ORIGINS` should be frontend origin(s).
- `VITE_API_BASE_URL` should point to the backend API origin.
- `GOOGLE_OAUTH_REDIRECT_URI` should point to backend storage OAuth callback.

For separate `*.onrender.com` frontend/backend subdomains:
- `AUTH_COOKIE_CROSS_SITE=true`
- keep `AUTH_COOKIE_DOMAIN` blank (host-only cookie)

## MongoDB `/test` temporary allowance

MongoDB URIs ending with `/test` are currently allowed for testing.
Before onboarding real client data or public launch, move to a dedicated production DB name.
