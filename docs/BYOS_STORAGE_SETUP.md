# BYOS Storage Setup

> Note: Google OAuth in Docketra is used for Drive BYOS connection only; Google login/signup on public auth pages is retired.

## BYOS + Metadata-Minimal Design (April 2026)

Docketra uses MongoDB as a control plane only. Firm business files are kept in firm-owned storage.

### What MongoDB stores
- Firm/workspace identifiers and auth metadata.
- Workflow/category/workbasket configuration.
- Audit logs and operational telemetry.
- External object references only (object key/path, provider file id, checksum, size, MIME type, version).
- Backup job metadata (`jobId`, `firmId`, archive object key, checksum, size, status, timestamps, email status).

### What MongoDB does **not** store
- Raw uploaded file binaries.
- Backup ZIP payloads.
- Generated export archives.
- Large attachment bodies.
- Unnecessary full-text file content.

## Primary Admin setup (Storage Settings UX)

- **Default behavior:** Docketra-managed Google Drive is active by default. Firms can upload files immediately with no setup.
- **Optional BYOS:** Primary Admin can click **Connect firm Google Drive** in Storage Settings and approve Google consent.
- **No OTP for Google OAuth:** OTP is **not** required for Google OAuth connect/refresh.
- **OTP scope:** OTP is only required for **advanced/manual** provider changes (OneDrive/S3 manual setup).

## 1) Supported providers
- Google Drive (**OAuth connect flow in-app**, recommended)
- Microsoft OneDrive (**manual / advanced setup only**: refresh-token + optional driveId; no Microsoft OAuth button yet)
- Amazon S3 / S3-compatible (**manual credentials setup**)

## 2) Google Drive OAuth setup
1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create/select a project.
3. Enable Google Drive API.
4. Create OAuth credentials (Web application).
5. Add redirect URI: `https://<api-domain>/api/storage/google/callback`.
6. Set env vars:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `FRONTEND_URL`
   - `STORAGE_TOKEN_SECRET`

### Required production OAuth contract
- `GOOGLE_OAUTH_REDIRECT_URI` **must exactly be**: `https://<api-domain>/api/storage/google/callback`.
- `FRONTEND_URL` should be the deployed app origin (example: `https://app.example.com`).
- `FRONTEND_ORIGINS` should include the exact deployed frontend origin (no wildcard).
- On success, Docketra redirects to: `/app/firm/:firmSlug/storage-settings?provider=google-drive&connected=1`.
- If firm slug cannot be resolved at callback time, Docketra redirects to `/storage/success?...` as a safe frontend recovery route.
- If callback reaches backend without a valid auth/session context, Docketra redirects with `reason=session_missing` to a safe frontend recovery route.

### Cross-origin auth/session requirements
If frontend and backend run on different origins, ensure auth cookie config supports Google callback-to-API session continuity:
- `AUTH_COOKIE_CROSS_SITE=true`
- `SameSite=None`
- `Secure=true`
- CORS allowlist includes the exact frontend origin.

## 3) Runtime behavior
- Default mode is Docketra-managed storage.
- BYOS providers can be changed from Storage Settings (OTP verification required).
- Folder layout after OAuth connect root provisioning:
  - `Docketra-<firmId>` root folder (current default behavior in `saveUserDriveConnection()`).
- Folder layout for advanced/manual drive confirmation flow:
  - `/Docketra/{firmName}/Cases/{caseId}/Attachments/` (used when drive context is explicitly confirmed).
- Folder layout for backups:
  - `/Docketra/{firmId}/Backups/` (provider folder)
  - logical object key reference: `backups/nightly/YYYY-MM-DD/<jobId>.zip.enc`
- Existing legacy attachments using `driveFileId` remain readable.
- `Docketra-<firmId>` is currently the standard OAuth-connect root naming behavior and remains fully supported.

### `googleConfirmDrive` endpoint intent
- `POST /api/storage/google/confirm-drive` is an **advanced/manual** endpoint for selecting a specific Drive/shared drive context after OAuth is already connected.
- Normal Google BYOS connect flow does not require this endpoint in standard UI flows.
- Keep this endpoint out of normal user-facing setup unless advanced drive selection is explicitly needed.

## 4) Nightly backup flow
- Nightly scheduler runs for firms with `settings.storageBackup.enabled = true`.
- Backup process creates a temporary archive, encrypts it (`.zip.enc`), uploads to configured firm storage, and deletes temp files immediately.
- Backup success/failure is tracked in MongoDB via metadata-only `BackupJob` records.
- Admin API returns backup history from metadata records (`GET /api/storage/exports`).

## 5) Email delivery policy
- Default delivery policy is `link_only` (no raw ZIP attachments).
- Notification emails include secure retrieval details (provider link / signed URL where supported).
- Direct attachment mode exists only as an explicit policy (`deliveryPolicy = attachment`) and should be restricted by size and encryption checks.

## 6) Security and privacy rationale
- Storage credentials remain encrypted at rest.
- Backup archives are encrypted before persistence.
- Per-firm isolation is enforced in backup/object pathing.
- Attachment/case file metadata models explicitly reject binary payload persistence.
- Audit events are emitted for:
  - backup creation/failure,
  - backup link issuance,
  - storage configuration changes.

## 7) Troubleshooting
- **Error: oauth_failed**
  - Verify OAuth client ID/secret and redirect URI match Google configuration.
- **Error: invalid_state / missing_state / missing_code**
  - Retry the full connect flow and ensure browser cookies are enabled for the API origin.
- **Error: no_refresh_token**
  - Reconnect with consent and offline access enabled.
- **Error: RATE_LIMIT_EXCEEDED**
  - OAuth endpoints are strictly limited. Wait and retry.


## Managed fallback contract
- `docketra_managed` is the default active provider when firm-owned BYOS is not connected.
- Docketra-managed mode still writes bytes to object/file storage (managed S3 backend), never MongoDB.
- MongoDB stores only metadata/control-plane records for attachments/backups.
- Status values: `ACTIVE_MANAGED`, `ACTIVE_BYOS`, `DISCONNECTED`, `ERROR`.
- Firm-owned BYOS remains recommended for data ownership and control, but is not required for runtime storage.

- Managed runtime fallback env: `MANAGED_STORAGE_S3_BUCKET` and `MANAGED_STORAGE_S3_REGION` required; `MANAGED_STORAGE_S3_PREFIX` optional; credentials optional when instance/task IAM role is used.
- Middleware and API client responses must be sanitized (`STORAGE_NOT_CONNECTED`) while detailed provider diagnostics remain server-side logs only.

## Canonical firm storage state
- `storageConfig.provider` is canonical for active provider selection.
- `storage.*` fields are derived/legacy compatibility only and should not be treated as source of truth when `storageConfig.provider` exists.
- Runtime status vocabulary is normalized to: `ACTIVE_MANAGED`, `ACTIVE_BYOS`, `DISCONNECTED`, `ERROR`.
- `ACTIVE_BYOS` requires a usable firm-owned provider configuration and usable credentials.
- `DISCONNECTED` is used when a firm-owned provider is selected but credentials/config are incomplete or disconnected.
- `ERROR` is used for credential decrypt failures or explicit provider error state.

- Drift detection should flag: `firm_connected` without `storageConfig.provider`, legacy `google-drive` name, and `docketra_drive` alias usage.
