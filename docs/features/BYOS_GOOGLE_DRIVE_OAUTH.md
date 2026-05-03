# BYOS Google Drive OAuth — Route Contract & Tenant Safety

## Overview

Docketra supports Bring-Your-Own-Storage (BYOS) via Google Drive for firm workspaces.  
Only a **Primary Admin** may initiate or complete the Google Drive OAuth connection.  
Docketra acts as a **control plane only**: firm and client document bytes reside in the firm-owned Google Drive, never in Docketra's database.

---

## Route Contract

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/storage/google/connect` | Required | Primary Admin | Generates state token + CSRF cookie, redirects browser to Google OAuth consent screen |
| `GET` | `/api/storage/google/callback` | Required (session cookie) | Primary Admin (checked in controller) | Receives OAuth code from Google, validates state, saves connection, redirects to firm workspace |
| `GET` | `/api/storage/configuration` | Required | Firm user | Returns current storage configuration for the authenticated firm |
| `GET` | `/api/storage/ownership-summary` | Required | Firm admin | Returns storage ownership summary, warnings, and last export metadata |

All routes under `/api/storage` are mounted with:
```
authenticate → firmContext → requireTenant → tenantThrottle → invariantGuard({ requireFirm: true, forbidSuperAdmin: true })
```

---

## OAuth Flow

```
Browser (StorageSettingsPage)
  │
  │  window.location.assign('/api/storage/google/connect')
  ▼
GET /api/storage/google/connect          [requires PRIMARY_ADMIN]
  │  builds state token (tenantId + firmSlug + provider + nonce, HMAC-signed)
  │  sets HttpOnly storage_oauth_state cookie (10 min TTL)
  │  redirects browser → https://accounts.google.com/o/oauth2/v2/auth?state=...
  ▼
Google OAuth Consent Screen
  │  user grants or denies access
  ▼
GET /api/storage/google/callback?code=...&state=...    [no requirePrimaryAdmin middleware]
  │  validates: state cookie == state param (CSRF check, timing-safe)
  │  decodes state: verifies provider == google_drive, tenantId == req.firmId
  │  verifies role == PRIMARY_ADMIN (redirect on failure, not JSON 403)
  │  exchanges code for tokens via googleapis
  │  requires refresh_token (user must have granted offline access)
  │  saves encrypted credentials to Firm.storageConfig
  │  clears state cookie (Max-Age=0)
  │  redirects → /app/firm/:firmSlug/storage-settings?storage=google-drive&connected=1
  ▼
StorageSettingsPage (frontend)
  │  reads connected=1 from query params
  │  shows success toast + reloads storage configuration
  │  cleans up query params via history.replaceState
```

---

## State Token Structure

The state token is a base64url-encoded JSON payload + HMAC-SHA256 signature:

```
<base64url(JSON)>.<hex_hmac_sha256>
```

Payload fields:

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | string | Firm's canonical tenant ID (prevents cross-tenant connection) |
| `firmSlug` | string \| null | Firm slug for browser redirect after callback |
| `provider` | `"google_drive"` | Ensures token is only valid for this provider |
| `nonce` | string (32 hex chars) | Random nonce for replay protection |

The signature is computed with `HMAC-SHA256` using `JWT_SECRET`.  
Validation uses `crypto.timingSafeEqual` to prevent timing attacks.

---

## Error Redirects

All errors in the callback result in a browser redirect (never a JSON response):

| Error | Redirect target |
|-------|----------------|
| `oauth_denied` | `/app/firm/:firmSlug/storage-settings?storageError=oauth_denied` |
| `missing_oauth_params` | `/?storageError=missing_oauth_params` |
| `invalid_state` | `/?storageError=invalid_state` |
| `tenant_mismatch` | `/app/firm/:firmSlug/storage-settings?storageError=tenant_mismatch` |
| `insufficient_role` | `/app/firm/:firmSlug/storage-settings?storageError=insufficient_role` |
| `no_refresh_token` | `/app/firm/:firmSlug/storage-settings?storageError=no_refresh_token` |
| `storage_configuration_invalid` | `/app/firm/:firmSlug/storage-settings?storageError=storage_configuration_invalid` |
| `oauth_failed` | `/app/firm/:firmSlug/storage-settings?storageError=oauth_failed` |
| `redirect_failed` | `/?storageError=redirect_failed` |

If `firmSlug` cannot be resolved from the state token, errors fall back to `${FRONTEND_URL}/?storageError=<reason>`.

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret from Google Cloud Console |
| `GOOGLE_OAUTH_REDIRECT_URI` | Must exactly match the redirect URI registered in Google Cloud Console. Example: `https://api.yourdomain.com/api/storage/google/callback` |
| `STORAGE_TOKEN_SECRET` | Secret for TokenEncryption (encrypts stored refresh tokens) |
| `JWT_SECRET` | Used to sign HMAC for OAuth state tokens |
| `FRONTEND_URL` | Base URL of the frontend SPA (e.g. `https://app.yourdomain.com`) |

---

## Google Cloud Console Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Google Drive API**.
4. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
5. Application type: **Web application**.
6. Add the **Authorised redirect URI**:
   ```
   https://<api-domain>/api/storage/google/callback
   ```
7. Copy the **Client ID** and **Client Secret** to environment variables.
8. Set **OAuth consent screen** scopes to include `https://www.googleapis.com/auth/drive.file`.

---

## Security Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| Only Primary Admin can connect | Role check on `/connect` route (middleware) and inside `googleCallback` controller (redirect on failure) |
| CSRF / replay protection | HttpOnly state cookie must match state query param; timing-safe comparison |
| Cross-tenant protection | State token `tenantId` must match `req.firmId` from authenticated session |
| Token storage | Refresh tokens are encrypted with `MASTER_ENCRYPTION_KEY` before storage in `Firm.storageConfig` |
| No token leakage | Internal error messages are not forwarded to the browser; only safe reason codes are embedded in redirect URLs |
| State cookie security | `HttpOnly`, `SameSite=Lax`, `Secure` (in production), 10-minute TTL, cleared on callback completion |
| No binary data in MongoDB | Document bytes remain in Google Drive; only metadata (folder IDs, connection status) is stored |

---

## Frontend Handling

`StorageSettingsPage` reads the following query params on mount:

| Param | Value | Action |
|-------|-------|--------|
| `connected` | `"1"` | Show success toast, reload storage configuration, clean URL |
| `storageError` | error code | Show error message from `STORAGE_ERROR_LABELS` map, clean URL |

---

## Testing

The test suite `tests/byosGoogleDriveOAuthRouting.test.js` covers:

- State token includes `firmSlug`
- Callback success redirects to `/app/firm/:firmSlug/storage-settings?connected=1`
- Invalid state never redirects to `/api/login`
- `oauth_denied` redirects to firm error page
- Missing params redirect safely
- Tenant mismatch redirects safely
- Insufficient role redirects to firm error page
- `GET /configuration` route is registered
- `GET /connect` has `requirePrimaryAdmin` middleware
- `GET /callback` does NOT have `requirePrimaryAdmin` middleware (JSON 403 would break browser redirect flow)
