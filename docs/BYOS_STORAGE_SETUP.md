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

## 1) Supported providers
- Google Drive (OAuth connect flow in-app)
- Microsoft OneDrive (manual refresh-token + optional driveId entry)
- Amazon S3 / S3-compatible (bucket + region, optional IAM credentials)

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
   - `STORAGE_TOKEN_SECRET`

## 3) Runtime behavior
- Default mode is Docketra-managed storage.
- BYOS providers can be changed from Storage Settings (OTP verification required).
- Folder layout for new case attachments:
  - `/Docketra/{firmName}/Cases/{caseId}/Attachments/`
- Folder layout for backups:
  - `/Docketra/{firmId}/Backups/` (provider folder)
  - logical object key reference: `backups/nightly/YYYY-MM-DD/<jobId>.zip.enc`
- Existing legacy attachments using `driveFileId` remain readable.

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
- **Error: no_refresh_token**
  - Reconnect with consent and offline access enabled.
- **Error: RATE_LIMIT_EXCEEDED**
  - OAuth endpoints are strictly limited. Wait and retry.
