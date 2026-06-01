#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${REGION:=us-central1}"
: "${JOB_NAME:?Set JOB_NAME}"
: "${IMAGE_URI:?Set IMAGE_URI}"
: "${CLOUD_RUN_JOB_NAME:?Set CLOUD_RUN_JOB_NAME}"

# Deploy one Cloud Run Job resource per task.
# Example:
#   JOB_NAME=docketra-storage-health-check CLOUD_RUN_JOB_NAME=storage_health_check
gcloud run jobs deploy "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE_URI}" \
  --command "npm" \
  --args "run,start:job" \
  --set-env-vars "CLOUD_RUN_JOB_NAME=${CLOUD_RUN_JOB_NAME},NODE_ENV=production"
