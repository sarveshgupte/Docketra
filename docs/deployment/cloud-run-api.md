# Cloud Run API deployment (`src/server.js`)

## What changed
- Added root `Dockerfile` for production API container.
- Added `npm run start:api` script.
- API-side background schedulers removed from startup to keep API stateless.

## What stayed the same
- Express route tree and auth/tenancy contracts.
- MongoDB and Redis usage.
- Socket.IO endpoint (`/socket.io`) remains on API runtime.

## Build and deploy
```bash
PROJECT_ID="<gcp-project>"
REGION="us-central1"
SERVICE_NAME="docketra-api"
IMAGE_URI="gcr.io/${PROJECT_ID}/docketra-api:$(git rev-parse --short HEAD)"

gcloud builds submit --project "$PROJECT_ID" --tag "$IMAGE_URI" .

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE_URI" \
  --allow-unauthenticated \
  --port 8080
```

## Required env vars / secrets checklist
Minimum required for production:
- `NODE_ENV=production`
- `PORT=8080` (Cloud Run injects this; keep app reading `PORT`)
- `MONGO_URI` or `MONGODB_URI`
- `JWT_SECRET`
- `SUPERADMIN_*` bootstrap values
- `METRICS_TOKEN`
- `BREVO_API_KEY`
- `MAIL_FROM` (or `SMTP_FROM`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `STORAGE_TOKEN_SECRET` (if BYOS Google provider enabled)
- `MASTER_ENCRYPTION_KEY` when encryption provider is enabled
- `FRONTEND_URL` / `FRONTEND_ORIGINS`
- `REDIS_URL` (strongly recommended in production)

Recommended delivery: store secrets in Secret Manager and mount via Cloud Run secret env vars.

## MongoDB connection notes
- Keep using existing external MongoDB cluster.
- Allow Cloud Run egress CIDRs/VPC connector path as required by your Mongo provider.
- Keep connection string and pool tuning in env.

## Redis notes
- Keep existing Redis contract.
- For production on GCP: use Memorystore Redis (or managed external Redis) + Serverless VPC Access connector.
- Ensure `maxmemory-policy` is BullMQ/rate-limit compatible (see existing Redis policy checks).

## Socket.IO on Cloud Run
Current implementation is valid on Cloud Run for many workloads. Caveats:
- Use reasonable connection timeout and instance concurrency.
- Expect reconnects on scale-to-zero/instance rotation.
- For heavy fanout, consider adapter-backed pub/sub (Redis adapter) as follow-up.

## Uploads/local disk compatibility
- Cloud Run filesystem is ephemeral.
- Current temp upload flows can work **within a single request lifecycle**.
- Do not rely on persistence across restarts/instances.
- Follow-up: direct-to-object-storage upload for large async workflows.

## OAuth callback / authorized origins checklist
- Update callback URIs to new API domain:
  - `https://api.example.com/api/auth/google/callback`
  - `https://api.example.com/api/storage/google/callback`
- Update authorized frontend origins to Firebase/custom frontend domains.

## Smoke tests
- `GET /health` and `GET /api/health` return healthy.
- Auth login, token refresh, and tenant-scoped routes work.
- Socket connects to `/socket.io` with auth token.
- File upload endpoint works for allowed MIME/size.

## Rollback
- Cloud Run: shift traffic back to previous revision.
- Revert env/secret versions if needed.
