# Runtime boundaries on Google Cloud

## Goal
Keep Docketra behavior unchanged while making each runtime concern independently deployable and serverless-safe.

## Boundaries

### 1) Frontend runtime (Firebase Hosting)
- Serves static SPA artifacts from `ui/dist`.
- No backend logic runs here.
- API base URL is explicit (`VITE_API_BASE_URL`).

### 2) API runtime (Cloud Run service)
- Runs `src/server.js`.
- Owns HTTP API and Socket.IO handshake/emit behavior.
- Must remain stateless between requests.
- Does **not** start internal background schedulers.

### 3) Worker runtime (Cloud Run service)
- Runs `src/worker.js`.
- Owns BullMQ consumer workers.
- Owns in-process scheduler loops **only when** `ENABLE_WORKER_INTERVAL_SCHEDULERS=true` (recommended false in Google Cloud production).

### 4) Job runtime (Cloud Run Jobs)
- Runs `src/jobs/cloudRunJob.runner.js` with `CLOUD_RUN_JOB_NAME`.
- Handles explicit scheduled operations triggered by Cloud Scheduler (guarded by `ENABLE_CLOUD_RUN_JOB_ENTRYPOINTS=true`).
- Deploy model: **one Cloud Run Job resource per task**, each with a fixed `CLOUD_RUN_JOB_NAME`.

## Scheduler ownership matrix

| Task | Owner runtime | Trigger mechanism | Frequency | Rollback path |
|---|---|---|---|---|
| Storage health check | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-storage-health-check` | 8h | Worker interval flag on |
| Tmp upload cleanup | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-cleanup-tmp-uploads` | 6h | Worker interval flag on |
| Storage integrity queue scheduling | Worker runtime | Worker bootstrap registers BullMQ repeat cron (`enqueueDailyStorageIntegrityJob`) | daily 02:00 | restart worker to re-register |
| Auto reopen pending dockets | Cloud Run Job | Cloud Scheduler -> `docketra-auto-reopen` | 15–60m | manual job execute |
| Tenant metrics daily | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-tenant-metrics-daily` | daily | Worker interval flag on |
| Nightly storage backups | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-nightly-storage-backups` | daily | Worker interval flag on |

## Contract preservation
- API endpoints and payloads are unchanged.
- Auth and tenant boundaries are unchanged.
- MongoDB + Redis integration contracts remain unchanged.

## Operational notes
- WebSocket behavior is preserved; consider Redis adapter if horizontal socket fanout grows.
- Local disk use is ephemeral by platform design; safe only for short-lived staging.
- Redis remains required for production queue/rate-limit consistency.

## Manual verification gates before production cutover
1. OAuth callback URLs and frontend origins updated.
2. Redis connectivity and eviction policy validated from Cloud Run.
3. Job schedules executing as expected.
4. Upload + socket flows tested under multi-instance API deployment.
5. Duplicate schedule protection validated (no double backup/cleanup/storage-integrity/metrics/auto-reopen runs).
6. Notification worker startup validated once per worker boot.
7. Each Cloud Scheduler trigger is mapped to the intended Cloud Run Job resource.
