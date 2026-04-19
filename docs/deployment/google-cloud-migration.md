# Docketra Google Cloud Migration (Render-style ➜ Firebase Hosting + Cloud Run)

## Scope and intent
This migration keeps product behavior and data models intact while splitting runtime concerns for Google Cloud:

- **Frontend**: Vite static build on Firebase Hosting.
- **API**: Node/Express container on Cloud Run.
- **Background processing**: dedicated worker runtime + Cloud Run Jobs for scheduled/one-off background tasks.
- **Database**: MongoDB stays external.
- **Redis**: stays Redis-based (BullMQ + rate-limits), with Google-compatible production guidance.

## Repo/runtime audit summary

| Area | Current implementation | Google-cloud fit | Action |
|---|---|---|---|
| Frontend entry/build | `ui/package.json` + `vite build` -> `ui/dist` | ✅ Firebase Hosting-ready | Added `firebase.json` SPA rewrites; keep Vite unchanged. |
| API entry | `src/server.js` | ✅ Cloud Run-ready | Added Dockerfile + `start:api`; API still binds to `PORT`. |
| Worker entry | `src/worker.js` / `src/services/workerBootstrap.service.js` | ✅ Cloud Run service or worker process | Moved API-owned schedulers into worker runtime. |
| In-process schedulers | `setInterval` in API and worker modules | ⚠️ Not ideal for autoscaled Cloud Run API | Removed API scheduler startup; added Cloud Run Job runner entrypoint. |
| Cron-like behavior | BullMQ repeat + timer workers | ⚠️ Mixed model | Documented explicit Cloud Scheduler -> Cloud Run Job approach. |
| Upload temp/local disk | `uploads/private`, `uploads/tmp`, `os.tmpdir()` flows | ⚠️ Ephemeral disk only | Kept behavior, documented Cloud Run-safe constraints and follow-up path. |
| WebSocket/Socket.IO | `socket.io` on API server (`/socket.io`) | ✅ Supported (with sticky caveats) | Kept implementation, documented operational considerations. |
| Redis/BullMQ | `ioredis` + BullMQ queues/workers | ✅ Works if external Redis is reachable | Documented Memorystore/Redis deployment recommendations. |

## What changed in code
- Added production API containerization: `Dockerfile`, `.dockerignore`.
- Added Firebase Hosting config (`firebase.json`, `.firebaserc`) for SPA deployment.
- Added explicit API/worker/job scripts (`start:api`, `start:worker`, `start:job`).
- Added `src/jobs/cloudRunJob.runner.js` for Cloud Run Job-compatible execution.
- Removed API-side scheduler startup and moved those loops to worker runtime boundaries.
- Added deploy helper scripts in `scripts/deploy/`.

## Explicit runtime flags (scheduler ownership)
- `ENABLE_WORKER_INTERVAL_SCHEDULERS`
  - Purpose: controls in-process worker timer/repeat scheduler startup.
  - Local default: enabled (safe for local single-runtime workflows).
  - Recommended on Google Cloud production: `false`.
- `ENABLE_CLOUD_RUN_JOB_ENTRYPOINTS`
  - Purpose: allows/disallows Cloud Run job runner execution.
  - Local default: enabled.
  - Recommended on Google Cloud production: `true`.

## Scheduler ownership matrix (final)

| Task | Owner runtime | Trigger mechanism | Frequency | Rollback path |
|---|---|---|---|---|
| Storage health check | Cloud Run Job (prod) / Worker interval (local) | Cloud Scheduler -> `docketra-storage-health-check` (sets `CLOUD_RUN_JOB_NAME=storage_health_check`) | Every 8 hours | Re-enable worker interval scheduler flag |
| Tmp upload cleanup | Cloud Run Job (prod) / Worker interval (local) | Cloud Scheduler -> `docketra-cleanup-tmp-uploads` (sets `CLOUD_RUN_JOB_NAME=cleanup_tmp_uploads`) | Every 6 hours | Re-enable worker interval scheduler flag |
| Storage integrity queue scheduling | Worker runtime | Worker bootstrap registers BullMQ repeat job (`enqueueDailyStorageIntegrityJob`) | Daily 02:00 (cron `0 2 * * *`) | Keep worker running; if needed, manually re-register by restarting worker |
| Auto reopen pending dockets | Cloud Run Job | Cloud Scheduler -> `docketra-auto-reopen` (sets `CLOUD_RUN_JOB_NAME=auto_reopen_pending_dockets`) | 15–60 minutes | Increase Scheduler cadence or run job manually |
| Tenant case metrics daily | Cloud Run Job (prod) / worker module timer (local) | Cloud Scheduler -> `docketra-tenant-metrics-daily` (sets `CLOUD_RUN_JOB_NAME=tenant_case_metrics_daily`) | Daily 00:30 | Re-enable worker interval scheduler flag |
| Nightly storage backups | Cloud Run Job (prod) / Worker interval (local) | Cloud Scheduler -> `docketra-nightly-storage-backups` (sets `CLOUD_RUN_JOB_NAME=nightly_storage_backups`) | Daily off-peak | Re-enable worker interval scheduler flag |

## What stayed the same
- MongoDB schema/model behavior.
- Redis queue contracts and BullMQ-based workers.
- API routes, tenancy, and auth contracts.
- Socket.IO event contract and notification semantics.

## Exact service split
- **firebase-hosting**: serves `ui/dist` static SPA.
- **cloud-run-api**: serves Express API + Socket.IO endpoint.
- **cloud-run-worker**: long-running queue workers (BullMQ processors).
- **cloud-run-jobs**: scheduled/one-off tasks via `CLOUD_RUN_JOB_NAME`:
  - `storage_health_check`
  - `cleanup_tmp_uploads`
  - `auto_reopen_pending_dockets`
  - `tenant_case_metrics_daily`
  - `nightly_storage_backups`
- **Deployment model**: one Cloud Run Job resource per task (not a single shared job resource).

## Required Google services/APIs
- Cloud Run API
- Cloud Build API
- Artifact Registry API (or Container Registry)
- Cloud Scheduler API
- Secret Manager API
- Firebase Hosting (via Firebase project)
- Cloud Logging / Monitoring (recommended)

## Migration risk log
### Safe now
- API and worker startup are separated.
- Frontend can deploy independently from backend.
- Scheduled workloads have explicit job entrypoint support.

### Needs follow-up
- Replace BullMQ repeat scheduler usage with explicit Cloud Scheduler-driven triggers.
- Migrate local upload temp staging to object storage-first flow for large files.

### Do not merge/deploy without manual verification
- OAuth redirect URI/authorized origins update.
- Redis connectivity and TLS policy validation from Cloud Run.
- Socket.IO real-time behavior under multi-instance load.

## Future improvement options
- **Firebase App Hosting vs Firebase Hosting**: keep Firebase Hosting now (simpler static Vite deployment); evaluate App Hosting only if SSR/edge-rendering is required later.
- **Worker architecture**: progressively move recurring timers/BullMQ repeat jobs to Cloud Scheduler + Cloud Run Jobs / Pub/Sub.
- **Redis target**: keep external Redis for low-risk migration, then evaluate Memorystore (Redis) with VPC connector + private service networking.

## Manual verification checklist
- [ ] Confirm **no duplicate backups** over one full schedule window.
- [ ] Confirm **no duplicate tmp cleanup** executions during the same window.
- [ ] Confirm **no duplicate auto reopen** runs (single Scheduler-owned path).
- [ ] Confirm **no duplicate tenant metrics daily** runs.
- [ ] Confirm **storage integrity scheduling runs once** per intended daily schedule in production.
- [ ] Confirm **notification worker starts only once** (no duplicate bootstrap entries).
- [ ] Confirm worker boots cleanly with `ENABLE_WORKER_INTERVAL_SCHEDULERS=false`.
- [ ] Confirm each Cloud Scheduler trigger points to the correct Cloud Run Job resource.
- [ ] Confirm no Cloud Run Job resource has a mismatched `CLOUD_RUN_JOB_NAME`.
