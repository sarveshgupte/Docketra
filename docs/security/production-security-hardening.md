# Production security hardening (April 2026)

## Scope

This pass closes unsafe production defaults and removes unsupported provider traps without adding new security features.

## Changes made

### 1) Vite production source maps
- `ui/vite.config.js` now disables source maps for production builds by default.
- Production source maps are enabled only when `VITE_ENABLE_PROD_SOURCEMAPS=true` is explicitly set.

### 2) Unsupported encryption providers now fail closed
- Startup env validation now rejects unsupported `ENCRYPTION_PROVIDER` values.
- Supported values are now: `local`, `disabled`.
- `kms` is intentionally rejected because KMS implementation is not complete.
- Runtime provider resolution in `src/security/encryption.service.js` now throws for unsupported values instead of silently falling back.

### 3) Unsupported AI providers cannot be selected
- AI configuration route validation now only accepts `openai`.
- AI settings controller now rejects non-openai providers.
- AI runtime provider map now only includes implemented providers.
- AI Settings UI provider dropdown now exposes only OpenAI.

### 4) CSP reporting defaults
- CSP report ingestion route (`/api/csp-violation`) is now opt-in.
- Enable only when `CSP_REPORTING_ENABLED=true`.
- Default behavior is safer/quiet by avoiding unsolicited report ingestion in production.

### 5) Metrics/debug access hardening
- `/api/debug/*` remains non-production only.
- `/metrics` requires `Bearer <METRICS_TOKEN>`.
- `/api/metrics/security` now requires bearer token in production (no superadmin fallback), preventing casual exposure via authenticated browser sessions.

### 6) Public env variable guardrails
- Dashboard support contact now reads only `VITE_SUPPORT_EMAIL` (explicitly public) and no longer references non-`VITE_` vars.
- UI env example now documents public-safe variables and production sourcemap toggle.

### 7) Logging hygiene
- Removed remaining production `console.log` trace from report export flow.
- Existing dev-only logs continue to use guarded paths (`safeConsole` / dev checks).

## Required production environment variables

At minimum:
- `METRICS_TOKEN` (required)
- `ENCRYPTION_PROVIDER` (`local` or `disabled`)
- `MASTER_ENCRYPTION_KEY` (required when `ENCRYPTION_PROVIDER != disabled`)
- `JWT_SECRET`
- `MONGO_URI` or `MONGODB_URI`
- `SUPERADMIN_XID`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD_HASH`, `SUPERADMIN_OBJECT_ID`
- `BREVO_API_KEY`
- `MAIL_FROM` or `SMTP_FROM`
- BYOS google vars:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URI`
  - `STORAGE_TOKEN_SECRET`

Optional hardening toggles:
- `CSP_REPORTING_ENABLED=true` (only if report ingestion is actively monitored)
- `VITE_ENABLE_PROD_SOURCEMAPS=true` (only for tightly controlled incident debugging)

## Regression coverage added

- `tests/productionConfigValidation.test.js`
  - rejects unsupported encryption providers
  - rejects unsupported AI provider env values
  - requires metrics token in production

- `tests/internalMetricsAccess.regression.test.js`
  - verifies production `/api/metrics/security` middleware requires bearer token and blocks unauthenticated access
