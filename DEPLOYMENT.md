# Docketra Deployment Guide (GCP & Firebase)

This is the production deployment guide for Docketra, which is hosted on **Google Cloud Platform (GCP)** and **Firebase**.

---

## 1) Architecture Overview

Docketra uses a split-runtime architecture optimized for serverless scalability:

1. **Frontend UI**:
   - Built as a React SPA with Vite.
   - Hosted on **Firebase Hosting** (`docketra-prod` project) for global CDN delivery, clean routing, and fast load times.
   
2. **Backend API**:
   - Node.js Express application running inside a Docker container.
   - Deployed on **Google Cloud Run** (`docketra-api` in region `us-central1`) as a managed service, scaling automatically based on traffic.

3. **Background Jobs / Tasks**:
   - Executed as serverless tasks using the Cloud Run jobs runner (`src/jobs/cloudRunJob.runner.js`).
   - Triggered on-demand or on cron schedules (e.g., using **Google Cloud Scheduler** calling Cloud Run jobs).

---

## 2) Prerequisites

### Accounts and Services
- **Google Cloud Platform** account with the `docketra-prod` project.
- **Firebase** project linked to the GCP project.
- **MongoDB Atlas** (or equivalent) production database cluster.
- **Upstash Redis** (or equivalent) serverless database for rate limiting and socket events.

### Local CLI & Tooling
- Node.js 20 LTS.
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`) authenticated to your account (`firebase login`).
- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) authenticated and configured (`gcloud auth login`).

---

## 3) Environment Variables Configuration

### Frontend Build-time Variables (Vite)
These are injected during compilation of the UI assets:
- `VITE_API_BASE_URL`: Public API URL endpoint (e.g., `https://docketra-api-1078507569854.us-central1.run.app/api`).
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID for sign-in.
- `VITE_SUPPORT_EMAIL`: Support contact email.
- `VITE_TURNSTILE_SITE_KEY`: Cloudflare Turnstile key for bot protection (if enabled).

### Backend Runtime Variables (Cloud Run)
Configured in the Google Cloud Run Service/Job environment settings:
- `NODE_ENV=production`
- `PORT=8080` (Cloud Run overrides and injects this automatically)
- `MONGO_URI`: MongoDB connection string.
- `REDIS_URL`: Redis database connection URI.
- `ALLOW_REDIS_FALLBACK=true`: Configures whether the server degraded boots if Redis is down.
- `JWT_SECRET`: Secret token signature key.
- `STORAGE_TOKEN_SECRET`: Key for OAuth tokens encryption.
- `MASTER_ENCRYPTION_KEY`: Data encryption key.
- `API_PUBLIC_ORIGIN`: Public domain URL of the Cloud Run API service.
- `FRONTEND_URL`: URL of the primary frontend application (e.g., `https://docketra-prod.web.app`).
- `FRONTEND_ORIGINS`: Comma-separated allowed CORS origins (e.g., `https://docketra-prod.web.app,https://docketra-prod.firebaseapp.com`).
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Credentials for Google Drive / Authentication.
- `GOOGLE_AUTH_REDIRECT_URI`: OAuth callback for sign-in (e.g., `https://docketra-api-1078507569854.us-central1.run.app/api/auth/google/callback`).
- `GOOGLE_OAUTH_REDIRECT_URI`: OAuth callback for storage integration (e.g., `https://docketra-api-1078507569854.us-central1.run.app/api/storage/google/callback`).
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD_HASH` / `SUPERADMIN_XID` / `SUPERADMIN_OBJECT_ID`: Core Super Admin bootstrap credentials.

---

## 4) Manual Deployment Commands

If you need to deploy changes manually from your workstation:

### Step A: Build & Deploy Frontend (Firebase Hosting)
1. Navigate to the UI directory and install dependencies:
   ```bash
   cd ui
   npm ci
   ```
2. Build the project using production environment variables:
   ```bash
   VITE_API_BASE_URL="https://docketra-api-1078507569854.us-central1.run.app/api" \
   VITE_GOOGLE_CLIENT_ID="1078507569854-c24hg50jkar8p68ooumkdebr3qtrcoe5.apps.googleusercontent.com" \
   VITE_SUPPORT_EMAIL="sarveshgupte@gmail.com" \
   VITE_TURNSTILE_SITE_KEY="0x4AAAAAADUM0lvwvSX_G56o" \
   npm run build
   ```
3. Deploy the compiled assets (`ui/dist`) to Firebase Hosting:
   ```bash
   cd ..
   firebase deploy --only hosting --project docketra-prod
   ```

### Step B: Build & Deploy Backend (Google Cloud Run)
1. Build the Docker container image remotely on GCP Cloud Build:
   ```bash
   gcloud builds submit --project docketra-prod --tag gcr.io/docketra-prod/docketra-api:latest .
   ```
2. Deploy the container image to Google Cloud Run (preserving env variables already configured on the service):
   ```bash
   gcloud run deploy docketra-api \
     --project docketra-prod \
     --region us-central1 \
     --image gcr.io/docketra-prod/docketra-api:latest \
     --platform managed \
     --allow-unauthenticated
   ```

---

## 5) Automated Deployment (GitHub Actions CI/CD)

The project includes a Continuous Deployment pipeline defined in [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml).

### Execution Flow
Every push to the `main` branch automatically:
1. Checks out the code and sets up Node.js.
2. Builds the React UI inside the `ui/` directory.
3. Deploys UI assets to Firebase Hosting using `FirebaseExtended/action-hosting-deploy`.
4. Authenticates to GCP using service account credentials.
5. Submits the code to Cloud Build to build the container image.
6. Deploys the new container image to the `docketra-api` Cloud Run service.

### Required Repository Secrets
To run the automated deployment pipeline, configure the following secrets in your GitHub Repository settings (`Settings -> Secrets and variables -> Actions`):
- `FIREBASE_SERVICE_ACCOUNT_DOCKETRA_PROD`: Service account key JSON for Firebase deployments.
- `GCP_SA_KEY`: Service account key JSON with permissions to push to Google Container Registry (GCR), trigger Cloud Build, and update Cloud Run services.

---

## 6) Background Jobs Execution

Google Cloud Run does not support long-running daemon workers like traditional VPS or PaaS setups (e.g. Render). Instead, background tasks are run on demand or scheduled.

### Job Runner Entrypoint
Background actions run through the [cloudRunJob.runner.js](file:///src/jobs/cloudRunJob.runner.js) entrypoint:
```bash
node src/jobs/cloudRunJob.runner.js <job_name>
```

### Supported Job Names
- `storage_health_check`: Validates third-party storage connections and health status.
- `cleanup_tmp_uploads`: Deletes expired temporary file uploads from the server disk.
- `auto_reopen_pending_dockets`: Transitions expired/pending dockets back to active states.
- `tenant_case_metrics_daily`: Aggregates case & task statistics for tenant workspaces.
- `nightly_storage_backups`: Generates and exports daily backups for external storage profiles.

### Scheduling Jobs on GCP
To automate these jobs:
1. Create a **Google Cloud Run Job** for Docketra pointing to the container image.
2. Configure the Cloud Run Job override command to execute the specific job (e.g. `node`, `src/jobs/cloudRunJob.runner.js`, `storage_health_check`).
3. Set up a **Google Cloud Scheduler** trigger targeting the Cloud Run Job endpoint on your desired cron schedule (e.g., `0 2 * * *` for nightly backups).

---

## 7) Post-Deployment Verification Checklist

After deploying updates, verify these operations:
- [ ] **Frontend**: Access `https://docketra-prod.web.app` and ensure the page loads with modern layout.
- [ ] **Backend Health**: Verify `https://docketra-api-1078507569854.us-central1.run.app/health` returns `{"status":"UP"}` (or similar JSON).
- [ ] **Database Connection**: Confirm you can log in as a superadmin or tenant user.
- [ ] **CORS Settings**: Check that frontend requests do not throw console errors related to Cross-Origin Resource Sharing.
- [ ] **File Storage**: Test a file upload to verify the active storage driver (e.g. Google Drive integration) successfully uploads, indexes, and downloads items.
- [ ] **Background Jobs**: Execute a dry-run of a Cloud Run Job command to confirm there are no environment variable or connection errors on startup.

---

## 8) Troubleshooting Common Deployment Issues

### Firebase Deploy Fails with `403 Permission Denied`
- **Error**: `Forbidden` or `Permission denied on resource project docketra-prod` during Firebase Hosting step.
- **Cause**: The Service Account represented by `FIREBASE_SERVICE_ACCOUNT_DOCKETRA_PROD` lacks the `Firebase Hosting Admin` IAM permission.
- **Solution**: 
  1. Open the **Google Cloud Console** IAM settings.
  2. Locate the service account email (usually `github-action-...@docketra-prod.iam.gserviceaccount.com`).
  3. Edit its roles and assign the **Firebase Hosting Admin** role.

### Cloud Run Service Fails to Start (Crash Loop)
- Check Cloud Run Log Explorer. The application validates environment variables during startup and will crash if required keys (like `MONGO_URI`, `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`) are missing.
- Ensure that the container starts up and binds within the allocated timeout period.

### Google Drive/OAuth callback redirects to the wrong domain
- Verify that `GOOGLE_AUTH_REDIRECT_URI` and `GOOGLE_OAUTH_REDIRECT_URI` exactly match the redirect URI registered in the Google Cloud Console APIs & Services credential settings.
- Ensure `API_PUBLIC_ORIGIN` matches the current API subdomain.
