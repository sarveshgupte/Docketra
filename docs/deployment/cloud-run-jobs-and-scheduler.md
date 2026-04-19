# Cloud Run Jobs + Cloud Scheduler (background/scheduled workloads)

## Runtime boundary
- API service: request/response + socket endpoint only.
- Worker service: BullMQ long-running consumers.
- Cloud Run Jobs: deterministic scheduled tasks, invoked by Cloud Scheduler.

## Ownership flags
- `ENABLE_WORKER_INTERVAL_SCHEDULERS`
  - Google Cloud production: set to `false` to prevent worker timer overlap with Cloud Scheduler jobs.
  - Local dev: can remain `true`.
- `ENABLE_CLOUD_RUN_JOB_ENTRYPOINTS`
  - Google Cloud production: set to `true`.
  - Set `false` only to emergency-disable Job entry execution.

## Job runner
`src/jobs/cloudRunJob.runner.js` supports:
- `storage_health_check`
- `cleanup_tmp_uploads`
- `auto_reopen_pending_dockets`
- `tenant_case_metrics_daily`
- `nightly_storage_backups`

Run manually:
```bash
CLOUD_RUN_JOB_NAME=storage_health_check npm run start:job
```

## Deployment model (explicit)
Use **one Cloud Run Job resource per task**.  
Reason: the current runner executes one `CLOUD_RUN_JOB_NAME` value per job execution, and each deployed Cloud Run Job stores that value in its env.

## Deploy a Cloud Run Job
```bash
IMAGE_URI="gcr.io/<project>/docketra-api:<tag>"

# one deployed Cloud Run Job resource per task
JOB_NAME=docketra-storage-health-check CLOUD_RUN_JOB_NAME=storage_health_check IMAGE_URI="$IMAGE_URI" ./scripts/deploy/gcloud-run-job.sh
JOB_NAME=docketra-cleanup-tmp-uploads CLOUD_RUN_JOB_NAME=cleanup_tmp_uploads IMAGE_URI="$IMAGE_URI" ./scripts/deploy/gcloud-run-job.sh
JOB_NAME=docketra-auto-reopen CLOUD_RUN_JOB_NAME=auto_reopen_pending_dockets IMAGE_URI="$IMAGE_URI" ./scripts/deploy/gcloud-run-job.sh
JOB_NAME=docketra-tenant-metrics-daily CLOUD_RUN_JOB_NAME=tenant_case_metrics_daily IMAGE_URI="$IMAGE_URI" ./scripts/deploy/gcloud-run-job.sh
JOB_NAME=docketra-nightly-storage-backups CLOUD_RUN_JOB_NAME=nightly_storage_backups IMAGE_URI="$IMAGE_URI" ./scripts/deploy/gcloud-run-job.sh
```

## Cloud Scheduler wiring
Use authenticated HTTP target hitting `jobs.run` API or `gcloud run jobs execute` automation.
Suggested schedule map:
- `cleanup_tmp_uploads`: every 6 hours
- `storage_health_check`: every 8 hours
- `tenant_case_metrics_daily`: daily at 00:30
- `auto_reopen_pending_dockets`: every 15–60 minutes (business SLA dependent)
- `nightly_storage_backups`: daily off-peak

## Scheduler ownership matrix

| Task | Owner runtime | Trigger mechanism | Frequency | Rollback path |
|---|---|---|---|---|
| `storage_health_check` | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-storage-health-check` | Every 8 hours | Temporarily set `ENABLE_WORKER_INTERVAL_SCHEDULERS=true` on worker |
| `cleanup_tmp_uploads` | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-cleanup-tmp-uploads` | Every 6 hours | Temporarily set `ENABLE_WORKER_INTERVAL_SCHEDULERS=true` on worker |
| `storage_integrity_repeat_registration` | Worker runtime | Worker bootstrap registers BullMQ repeat cron via `enqueueDailyStorageIntegrityJob()` | Daily 02:00 (`0 2 * * *`) | Restart worker to re-register repeat job |
| `auto_reopen_pending_dockets` | Cloud Run Job | Cloud Scheduler -> `docketra-auto-reopen` | 15–60 minutes | Trigger job manually while scheduler issue is fixed |
| `tenant_case_metrics_daily` | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-tenant-metrics-daily` | Daily 00:30 | Temporarily set `ENABLE_WORKER_INTERVAL_SCHEDULERS=true` on worker |
| `nightly_storage_backups` | Cloud Run Job (prod) | Cloud Scheduler -> `docketra-nightly-storage-backups` | Daily off-peak | Temporarily set `ENABLE_WORKER_INTERVAL_SCHEDULERS=true` on worker |

## Worker service deployment (queue processors)
Deploy a separate Cloud Run service from same image but command override:
```bash
gcloud run deploy docketra-worker \
  --region us-central1 \
  --image gcr.io/<project>/docketra-api:<tag> \
  --command npm \
  --args run,start:worker \
  --no-allow-unauthenticated
```

## Secrets/env checklist
Worker/job use same base env as API for DB/auth/encryption where needed:
- Mongo URI
- Redis URL
- encryption keys
- email provider config (backup notifications)

## Known limitations / deferred follow-ups
- Some existing repeat scheduling still exists in BullMQ and timer workers; migrate gradually to explicit Cloud Scheduler ownership.
- Long-running workers in Cloud Run require min instances or external orchestrator expectations.

## Manual verification checklist
- [ ] Confirm backups run once per window (no duplicate emails/records).
- [ ] Confirm tmp cleanup runs once per window.
- [ ] Confirm storage integrity repeat job is registered once and executes once per intended schedule.
- [ ] Confirm auto reopen and tenant metrics each run once per schedule.
- [ ] Confirm notification worker is booted once (no duplicate startup registration).
- [ ] Confirm worker startup is healthy with `ENABLE_WORKER_INTERVAL_SCHEDULERS=false`.
- [ ] Confirm each Cloud Scheduler entry triggers the intended Cloud Run Job resource.
- [ ] Confirm no Cloud Run Job resource is configured with the wrong `CLOUD_RUN_JOB_NAME`.

## Rollback
- Disable Scheduler jobs.
- Re-enable prior always-on worker process in previous platform.
- Re-route async work to prior worker deployment.
