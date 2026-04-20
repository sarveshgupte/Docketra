# Docketra Deployment Guide (Render-First)

This is the production deployment guide for Docketra on **Render**.

The repository has been intentionally rolled back from an incomplete Google Cloud/Firebase migration so there is one clear deployment target and one clear runtime ownership model.

---

## 1) Prerequisites

### Accounts and services
- Render account and access to the target workspace/project.
- MongoDB (Atlas or equivalent) production cluster.
- Redis instance for queue workers/rate limiting (required for full production behavior).
- Domain/DNS access (if using custom API/frontend domains).

### Runtime/tooling
- Node.js 18+ (Node 20 LTS recommended).
- npm 9+.

### Repository assumptions
- Backend API entrypoint is `npm start` (`src/server.js`).
- Worker entrypoint is `npm run start:worker` (`src/worker.js`).
- Frontend is built from `ui/` with Vite.

---

## 2) Render deployment model

Render is the active deployment target with separate runtimes:

1. **API Web Service**
   - Handles HTTP API + socket traffic.
   - Command: `npm start`.

2. **Worker Service**
   - Handles BullMQ/background processing + scheduler intervals.
   - Command: `npm run start:worker`.

> Keep API and worker as separate Render services to avoid duplicate worker boot or duplicate scheduled execution.

---

## 3) Build and start commands (exact)

### Build command
```bash
npm install && npm --prefix ui install && npm --prefix ui run build
```

### Start command (API service)
```bash
npm start
```

### Start command (worker service)
```bash
npm run start:worker
```

---

## 4) Required environment variables

Minimum required for stable production:

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
- `REDIS_URL`

Conditional/feature-dependent:
- `MASTER_ENCRYPTION_KEY` when `ENCRYPTION_PROVIDER` is not `disabled`.
- Google auth/BYOS variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_REDIRECT_URI`, `GOOGLE_OAUTH_REDIRECT_URI`, `STORAGE_TOKEN_SECRET`) when those features are enabled.

---

## 5) Frontend origin / CORS notes

- Production CORS uses `FRONTEND_ORIGINS` (comma-separated).
- Set **exact browser origins** only (scheme + hostname + optional port).
- Do **not** use wildcard origins (`*`) in production.
- Keep `FRONTEND_URL` aligned with the primary user-facing app URL.

Example:
```env
FRONTEND_URL=https://app.example.com
FRONTEND_ORIGINS=https://app.example.com,https://admin.example.com
```

---

## 6) Google OAuth callback notes

Docketra still supports Google auth/BYOS features; only Google **deployment** artifacts were removed.

When Google features are enabled, ensure callback URLs point to the active API domain:

- `GOOGLE_AUTH_REDIRECT_URI=https://<api-domain>/api/auth/google/callback`
- `GOOGLE_OAUTH_REDIRECT_URI=https://<api-domain>/api/storage/google/callback`

Also update Google OAuth authorized origins to include frontend domain(s) in `FRONTEND_ORIGINS`.

---

## 7) Worker/scheduler ownership on Render

Scheduler ownership is Render worker-centric:

- temp upload cleanup → worker runtime interval
- storage health checks → worker runtime interval
- nightly storage backups → worker runtime scheduler service
- storage integrity scheduling registration → worker bootstrap
- auto-reopen/metrics background execution → worker runtime modules

API runtime remains request/response focused and does not own worker bootstrap.

---

## 8) Deployment steps on Render

1. Create/update API Web Service.
   - Build command: `npm install && npm --prefix ui install && npm --prefix ui run build`
   - Start command: `npm start`
2. Create/update Worker Service from same repo/branch.
   - Build command: same as API (or reuse build cache based on Render setup)
   - Start command: `npm run start:worker`
3. Set environment variables for both services (worker requires Redis/Mongo/encryption/email vars as needed by jobs).
4. Deploy API, then deploy worker.
5. Run verification checklist below.

---

## 9) Verification checklist

- [ ] API service starts and binds to Render-provided `PORT`.
- [ ] `/health` and `/api/health` return healthy.
- [ ] Worker service logs show worker runtime boot success.
- [ ] No duplicate scheduler activity (cleanup/backups/health/integrity/metrics).
- [ ] Auth/login flow works from configured frontend origins.
- [ ] Google OAuth callback (if enabled) resolves to correct API domain.
- [ ] File upload and queue-backed operations process successfully.

---

## 10) Troubleshooting

### API fails to boot
- Validate required env vars (especially `MONGO_URI`/`MONGODB_URI`, `JWT_SECRET`, `SUPERADMIN_*`).
- Confirm `NODE_ENV=production`.
- Check Render logs for environment validation errors.

### CORS blocked requests
- Verify request origin is in `FRONTEND_ORIGINS`.
- Ensure origins include protocol (`https://`) and no trailing whitespace.

### Worker not processing jobs
- Confirm worker service is running with `npm run start:worker`.
- Confirm `REDIS_URL` is set and reachable.
- Check worker logs for startup failures per module.

### Duplicate scheduled jobs
- Confirm only one worker service instance/ownership path is active for schedules.
- Check for accidentally duplicated worker services in Render.

---

## 11) Rollback notes

If a deployment is unhealthy:
1. Roll back API and worker services to the previous healthy Render deploy.
2. Re-verify environment variables and secrets.
3. Confirm worker service count/ownership to prevent duplicate schedules.
4. Re-run verification checklist before resuming normal traffic.

---

## 12) Google migration rollback summary (what was removed and why)

Removed migration-only artifacts that introduced dual-runtime ambiguity:
- Firebase config files (`firebase.json`, `.firebaserc`)
- Cloud Run/Firebase deployment docs
- Cloud Run deploy scripts
- Cloud Run job runner entrypoint (`src/jobs/cloudRunJob.runner.js`)
- Cloud Run-only package scripts (`start:api`, `start:job`)
- Cloud Run Dockerfile
- Cloud Run scheduler ownership flags in `.env.example`

Reason: Docketra is currently operated on Render; this cleanup restores a single, internally consistent deployment path without changing business/product behavior.
