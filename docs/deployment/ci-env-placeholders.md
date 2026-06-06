# CI Environment Placeholders for Production Validation

## Why CI provides placeholder production env values

The CI release gate runs `npm run validate:env:production` and `npm run validate:env:production:fixture` (as part of `npm run ci:backend:security`) to confirm that the `src/config/env.js` production validation rules are satisfied before any code reaches `main`.

Production validation requires certain fields that have no meaning in a CI context — for example, `BREVO_API_KEY` (transactional email provider) and `MAIL_FROM` (sender address for OTP/password-reset emails). Without these, `validate:env:production` would always fail in CI even though no real email delivery happens during the gate.

To keep the gate meaningful without hardcoding real secrets, CI provides **safe, clearly non-production values** for these fields. The current-env validation uses the CI job environment as-is and does not overwrite existing values. The fixture validation uses known safe placeholders solely to check that the schema rules are satisfied.

## Placeholder values

| Variable | CI placeholder value | Reason |
|---|---|---|
| `MAIL_FROM` | `no-reply@example.com` | Satisfies "must be present in production" — `example.com` is an IANA-reserved domain that cannot receive mail |
| `BREVO_API_KEY` | `ci-placeholder-brevo-key` | Satisfies "must be present in production" — clearly not a live provider key, never sent to Brevo |
| `SUPERADMIN_PASSWORD_HASH` | `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` | Satisfies required superadmin hash validation using a known test-only bcrypt placeholder (`password`) |
| `JWT_SECRET`, `JWT_PASSWORD_SETUP_SECRET`, `STORAGE_TOKEN_SECRET`, `METRICS_TOKEN` | long repeated CI-only strings | Satisfy production strength checks without using real signing or metrics secrets |
| `MASTER_ENCRYPTION_KEY` | 64-character hex CI-only string | Satisfies production encryption key format checks |
| `UPLOAD_SCAN_STRICT` | `true` | Ensures production upload scanning remains fail-closed |
| `AUTH_DEBUG_DIAGNOSTICS` | `false` | Ensures production auth diagnostics remain disabled |

These values appear in these places so the fix is self-contained:

1. **`.github/workflows/ci.yml` → `backend-release-gate` job `env:` section** — CI-only env for the workflow.
2. **`scripts/run-deploy-safety-gate.js`** — Local/CI deploy-safety wrapper with production-shaped test values.
3. **`scripts/validateEnvProduction.js --fixture`** — Schema fixture validation with known safe placeholders.

## What you must NOT do

- Do **not** commit real `BREVO_API_KEY`, `SMTP_PASS`, or other credentials anywhere in this repository.
- Do **not** remove `npm run validate:env:production` from `ci:backend:security` — it is the real current-env pre-deploy safety gate and must not overwrite existing values.
- Do **not** remove `npm run validate:env:production:fixture` from `ci:backend:security` — it protects the production schema contract independently of local or CI env drift.
- Do **not** weaken `src/config/env.js` production rules to silence CI failures. Fix the CI env instead.

## Where real production values live

Real production credentials are configured exclusively outside the repository:

- **Render** (current production host): Set environment variables in the Render dashboard per service (`API web service` and `Worker service`).
- **GitHub Actions** (if needed for integration tests): Use [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) (`Settings → Secrets and variables → Actions`).

Never copy production values into `package.json`, `.env` files committed to git, or CI `env:` sections.
