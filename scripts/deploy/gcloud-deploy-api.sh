#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${REGION:=us-central1}"
: "${SERVICE_NAME:=docketra-api}"
: "${IMAGE_NAME:=docketra-api}"

IMAGE_URI="gcr.io/${PROJECT_ID}/${IMAGE_NAME}:$(git rev-parse --short HEAD)"

gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE_URI}" .

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE_URI}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
