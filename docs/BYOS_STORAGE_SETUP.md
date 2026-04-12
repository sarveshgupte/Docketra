# BYOS Storage Setup

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
- Existing legacy attachments using `driveFileId` remain readable.

## 4) Troubleshooting
- **Error: oauth_failed**
  - Verify OAuth client ID/secret and redirect URI match Google configuration.
- **Error: no_refresh_token**
  - Reconnect with consent and offline access enabled.
- **Error: RATE_LIMIT_EXCEEDED**
  - OAuth endpoints are strictly limited. Wait and retry.
