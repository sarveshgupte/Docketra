# Environment Variables

All environment variables are documented in the root `.env.example` file, which is the authoritative source of truth for variable names and defaults. This document provides additional context on categories, requirements, and notes.

---

## Backend environment (root `.env`)

The root `.env` file configures the backend API in `src/`. Copy from the template:

```bash
cp .env.example .env
```

---

### Server and application

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `development` | Set to `production` in production |
| `PORT` | No | `5000` | Backend API port |
| `APP_NAME` | No | `Docketra` | Application name |

---

### Database

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `MONGO_URI` | Yes | — | Primary MongoDB connection string |
| `MONGODB_URI` | No | — | Legacy alias; use `MONGO_URI` for new setups |

Both `MONGO_URI` and `MONGODB_URI` are supported for backward compatibility. Prefer `MONGO_URI`.

---

### Frontend and CORS

| Variable | Required (prod) | Notes |
|----------|-----------------|-------|
| `FRONTEND_URL` | Yes | Primary frontend origin (used for CORS and email links) |
| `FRONTEND_ORIGINS` | Yes | Comma-separated list of allowed browser origins |
| `APP_ROOT_DOMAIN` | No | Root domain for cookie scoping |

Example:
```env
FRONTEND_URL=https://app.example.com
FRONTEND_ORIGINS=https://app.example.com,https://admin.example.com
```

---

### JWT and authentication

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Yes | Minimum 32 characters; use 64+ random characters in production |
| `JWT_PASSWORD_SETUP_SECRET` | Yes (prod) | Separate secret for password setup tokens |
| `JWT_REFRESH_EXPIRES_IN` | No | Default `7d` |

---

### Superadmin bootstrap

These variables provision the platform superadmin account on first boot. They must be set in production before the first deploy.

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPERADMIN_XID` | Yes | Superadmin xID (e.g. `X000001`) |
| `SUPERADMIN_EMAIL` | Yes | Superadmin email address |
| `SUPERADMIN_PASSWORD_HASH` | Yes | bcrypt hash of superadmin password |
| `SUPERADMIN_OBJECT_ID` | Yes | Fixed MongoDB ObjectId for the superadmin record |
| `SEED_ADMIN` | No | Set `true` to force re-seed on boot (dev/test only) |

To generate a bcrypt hash locally:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(h => console.log(h));"
```

---

### Email delivery

| Variable | Required (prod) | Notes |
|----------|-----------------|-------|
| `BREVO_API_KEY` | Yes | Brevo (formerly Sendinblue) transactional email API key |
| `MAIL_FROM` | Yes | Sender address, e.g. `"Docketra <noreply@example.com>"` |
| `SMTP_FROM` | No | Legacy fallback if `MAIL_FROM` is not set |

---

### Google auth and BYOS storage

These variables are only required when Google OAuth login or Google Drive BYOS storage is enabled.

| Variable | Required when | Notes |
|----------|--------------|-------|
| `GOOGLE_CLIENT_ID` | Google auth enabled | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google auth enabled | OAuth client secret |
| `GOOGLE_AUTH_REDIRECT_URI` | Google auth enabled | Must point to `<api-domain>/api/auth/google/callback` |
| `GOOGLE_CALLBACK_URL` | (legacy alias) | Same as `GOOGLE_AUTH_REDIRECT_URI` |
| `GOOGLE_OAUTH_REDIRECT_URI` | BYOS Google Drive | Must point to `<api-domain>/api/storage/google/callback` |
| `STORAGE_TOKEN_SECRET` | BYOS enabled | Secret for signing BYOS storage tokens |
| `DISABLE_GOOGLE_AUTH` | No | Default `true`; set `false` to enable Google login |
| `ENABLE_EXTERNAL_STORAGE` | No | Default `false`; set `true` to enable BYOS |

#### Managed (Docketra-managed) storage fallback

When BYOS is not connected, Docketra uses a managed S3-compatible bucket for file storage. These variables are only needed when `docketra_managed` runtime is active.

| Variable | Notes |
|----------|-------|
| `MANAGED_STORAGE_S3_BUCKET` | S3 bucket name |
| `MANAGED_STORAGE_S3_REGION` | AWS region |
| `MANAGED_STORAGE_S3_ACCESS_KEY_ID` | Optional; leave blank when using instance/task role |
| `MANAGED_STORAGE_S3_SECRET_ACCESS_KEY` | Optional |
| `MANAGED_STORAGE_S3_SESSION_TOKEN` | Optional; for temporary credentials |
| `MANAGED_STORAGE_S3_PREFIX` | Default `docketra-managed` |

---

### Encryption

| Variable | Required | Notes |
|----------|----------|-------|
| `ENCRYPTION_PROVIDER` | Yes | `local` to enable field encryption; `disabled` to skip |
| `MASTER_ENCRYPTION_KEY` | When `local` | 64-char hex or 44-char base64 |
| `MASTER_KEY` | (legacy alias) | Use `MASTER_ENCRYPTION_KEY` for new setups |
| `SECURITY_ENCRYPTION_KEY` | When enabled | Separate key for security-sensitive fields |

For local development, set `ENCRYPTION_PROVIDER=disabled` to skip encryption.

---

### Feature flags

| Variable | Default | Notes |
|----------|---------|-------|
| `DISABLE_FILE_UPLOADS` | `false` | Set `true` to disable file upload endpoints |
| `DISABLE_FIRM_CREATION` | `false` | Set `true` to prevent new firm registration |

---

### Redis

| Variable | Required (prod) | Notes |
|----------|-----------------|-------|
| `REDIS_URL` | Yes (production) | `redis://` or `rediss://` URL |
| `ALLOW_REDIS_FALLBACK` | No | Set `true` only for explicitly accepted degraded mode |

Leave `REDIS_URL` blank in development. The backend uses an in-memory fallback for idempotency and single-process rate limiting. In production, a missing or invalid `REDIS_URL` will cause startup failure unless `ALLOW_REDIS_FALLBACK=true`.

---

### Security rate limits

All rate limit variables are prefixed `SECURITY_RATE_LIMIT_`. Defaults are set in `.env.example`. Override only if your deployment traffic patterns require tuning.

Key variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `SECURITY_RATE_LIMIT_GLOBAL` | `1000` | Requests per window (global) |
| `SECURITY_RATE_LIMIT_AUTH` | `100` | Auth endpoint requests per window |
| `SECURITY_ACCOUNT_LOCK_ATTEMPTS` | `5` | Failed login attempts before account lock |
| `SECURITY_ACCOUNT_LOCK_SECONDS` | `1800` | Account lock duration |

See `.env.example` for the full list of rate limit variables.

---

### File uploads and malware scanning

| Variable | Default | Notes |
|----------|---------|-------|
| `SECURITY_UPLOAD_MAX_SIZE_MB` | `5` | Maximum upload size in MB |
| `SECURITY_UPLOAD_ALLOWED_MIME_TYPES` | `application/pdf,image/jpeg,image/png` | Allowed MIME types |
| `CLAMAV_HOST` | `clamav` | ClamAV host for malware scanning |
| `CLAMAV_PORT` | `3310` | ClamAV port |
| `UPLOAD_SCAN_STRICT` | `true` | Reject uploads when scanner is unreachable |

---

### Internal metrics and diagnostics

| Variable | Required (prod) | Notes |
|----------|-----------------|-------|
| `METRICS_TOKEN` | Yes | Bearer token for `/api/metrics` endpoint |
| `AUTH_DEBUG_DIAGNOSTICS` | — | Must be `false` in production |
| `CSP_REPORTING_ENABLED` | No | Enable CSP violation endpoint |
| `DB_LATENCY_THRESHOLD_MS` | `750` | DB query latency alert threshold |

---

### Build metadata (optional)

| Variable | Notes |
|----------|-------|
| `BUILD_VERSION` | Semantic version string |
| `BUILD_TIMESTAMP` | ISO 8601 build timestamp |
| `BUILD_TIME` | Legacy alias for `BUILD_TIMESTAMP` |
| `GIT_COMMIT` | Git commit SHA |

---

### Maintenance / script defaults

| Variable | Default | Notes |
|----------|---------|-------|
| `DEFAULT_FIRM_NAME` | `Example Firm` | Used by seed/bootstrap scripts |
| `DRY_RUN` | `false` | Enable dry-run mode for migration scripts |

---

## Frontend environment (`ui/.env`)

The Vite frontend in `ui/` uses its own `.env` file. Copy from the template:

```bash
cp ui/.env.example ui/.env
```

All frontend variables **must be prefixed with `VITE_`** — they are bundled into the browser app and are publicly readable. Do not store secrets here.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `VITE_API_BASE_URL` | Yes | `http://localhost:5000/api` | Backend API base URL |
| `VITE_SUPPORT_EMAIL` | No | `support@docketra.com` | Support email shown in UI |
| `VITE_ENABLE_PROD_SOURCEMAPS` | No | `false` | Enable production source maps |
| `VITE_ENABLE_GOOGLE_LOGIN` | No | `false` | Show Google login option |

For production, `VITE_API_BASE_URL` should be set to the full API URL (e.g. `https://api.example.com/api`) or `/api` if the backend serves the frontend from the same origin.

---

## Production security checklist

Before deploying to production, verify:

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` is at least 64 random characters
- [ ] `JWT_PASSWORD_SETUP_SECRET` is set and different from `JWT_SECRET`
- [ ] `SUPERADMIN_PASSWORD_HASH` is a real bcrypt hash (not the `.env.example` placeholder)
- [ ] `MASTER_ENCRYPTION_KEY` is set when `ENCRYPTION_PROVIDER=local`
- [ ] `METRICS_TOKEN` is at least 64 random characters
- [ ] `REDIS_URL` is set and reachable
- [ ] `FRONTEND_URL` and `FRONTEND_ORIGINS` point to the correct production origins
- [ ] `AUTH_DEBUG_DIAGNOSTICS=false`
- [ ] `UPLOAD_SCAN_STRICT=true`
- [ ] Google OAuth callback URLs updated if Google auth is enabled
