# BYOS Storage Setup (Google Drive Only)

## 1) Google Drive OAuth setup
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

## 2) Runtime behavior
- Docketra BYOS currently supports only **Google Drive**.
- Folder layout for new case attachments:
  - `/Docketra/{firmName}/Cases/{caseId}/Attachments/`
- Existing legacy attachments using `driveFileId` remain readable.

## 3) Troubleshooting
- **Error: oauth_failed**
  - Verify OAuth client ID/secret and redirect URI match Google configuration.
- **Error: no_refresh_token**
  - Reconnect with consent and offline access enabled.
- **Error: RATE_LIMIT_EXCEEDED**
  - OAuth endpoints are strictly limited. Wait and retry.
