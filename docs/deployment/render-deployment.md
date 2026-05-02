# Render Deployment (Current Production Target)

## Overview
Docketra runs on Render with clear runtime ownership:
- **API runtime** (web service): `npm start`
- **Worker runtime** (worker service): `npm run start:worker`

No Cloud Run/Firebase-specific deployment path is active.

## Build and start commands
Use these Render commands:

- **Build command**
  ```bash
  npm ci && npm --prefix ui ci && npm run build
  ```
- **Start command (API web service)**
  ```bash
  npm start
  ```
- **Start command (worker service)**
  ```bash
  npm run start:worker
  ```


## Local install and build commands
Use the same deterministic install flow locally when you want CI parity:

```bash
npm run ci:install
npm run build
npm run ci:release-gate
```

For day-to-day development you can still run app workflows directly after install (`npm run dev`, `npm --prefix ui run dev`).

## Why `npm ci` is preferred for CI/deploy
- Uses lockfiles (`package-lock.json` and `ui/package-lock.json`) to install exact versions for deterministic builds.
- Fails fast when lockfile and manifest drift, which surfaces dependency issues earlier.
- Avoids mutating lockfiles during deploy and removes hidden install side effects from build steps.

## Runtime ownership

### API web service
- Runs `src/server.js`
- Owns HTTP/API + socket server
- Does **not** bootstrap queue workers

### Worker service
- Runs `src/worker.js`
- Boots BullMQ workers
- Owns recurring scheduler intervals for:
  - temp upload cleanup
  - storage backups
  - storage health checks
  - storage integrity scheduling registration
  - auto reopen / metrics-related background processing handled in worker runtime modules

## Frontend/backend deployment assumptions
- Backend and worker run as separate Render services.
- Frontend is built from `ui/` during service build.
- Backend CORS policy is driven by `FRONTEND_ORIGINS` (plus `FRONTEND_URL` fallback).
- API runtime should stay stateless and must not bootstrap worker processors.

## Required environment variables
Minimum production baseline:
- `NODE_ENV=production`
- `MONGO_URI` or `MONGODB_URI`
- `JWT_SECRET`
- `SUPERADMIN_XID`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD_HASH`
- `SUPERADMIN_OBJECT_ID`
- `METRICS_TOKEN`
- `BREVO_API_KEY`
- `MAIL_FROM` (or `SMTP_FROM`)
- `FRONTEND_URL`
- `FRONTEND_ORIGINS`
- `REDIS_URL` (optional; recommended for distributed rate limits/queues)

Feature-dependent variables (keep when relevant):
- Google Auth/BYOS integration vars (`GOOGLE_*`, `STORAGE_TOKEN_SECRET`) if those product features are enabled
- Encryption keys (`MASTER_ENCRYPTION_KEY`) when encryption is enabled

## Operational checks after deploy
- `GET /health` and `GET /api/health` succeed
- Worker logs show runtime boot success and expected worker registration
- No duplicate scheduler execution window for cleanup/backup/health/integrity/metrics jobs
- API and worker each run exactly once per Render service definition

## Rollback context
The repo was explicitly rolled back from an incomplete Google Cloud migration to prevent dual-ownership scheduling and deployment drift. Render remains the single active deployment target.
