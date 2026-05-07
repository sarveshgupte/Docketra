# CI Environment Placeholders for Production Validation

## Why CI provides placeholder production env values

The CI release gate runs `npm run validate:env:production` (as part of `npm run ci:backend:security`) to confirm that the `src/config/env.js` production validation rules are satisfied before any code reaches `main`.

Production validation requires certain fields that have no meaning in a CI context — for example, `BREVO_API_KEY` (transactional email provider) and `MAIL_FROM` (sender address for OTP/password-reset emails). Without these, `validate:env:production` would always fail in CI even though no real email delivery happens during the gate.

To keep the gate meaningful without hardcoding real secrets, CI provides **safe, clearly non-production placeholder values** for these fields. The validation script uses them solely to check that the schema rules are satisfied, never to connect to any live service.

## Placeholder values

| Variable | CI placeholder value | Reason |
|---|---|---|
| `MAIL_FROM` | `no-reply@example.com` | Satisfies "must be present in production" — `example.com` is an IANA-reserved domain that cannot receive mail |
| `BREVO_API_KEY` | `ci-placeholder-brevo-key` | Satisfies "must be present in production" — obviously a dummy key, never sent to Brevo |
| `SUPERADMIN_PASSWORD_HASH` | `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` | Satisfies required superadmin hash validation using a known test-only bcrypt placeholder (`password`) |
| `UPLOAD_SCAN_STRICT` | `true` | Already set inline in the validation script |

These values appear in two places so the fix is self-contained:

1. **`package.json` → `validate:env:production` script** — Inline `process.env` assignments that are always used when the script runs, including locally.
2. **`.github/workflows/ci.yml` → `backend-release-gate` job `env:` section** — Belt-and-suspenders documentation so the CI intent is visible at a glance.

## What you must NOT do

- Do **not** commit real `BREVO_API_KEY`, `SMTP_PASS`, or other credentials anywhere in this repository.
- Do **not** remove `npm run validate:env:production` from `ci:backend:security` — it is a required pre-deploy safety gate.
- Do **not** weaken `src/config/env.js` production rules to silence CI failures. Fix the CI env instead.

## Where real production values live

Real production credentials are configured exclusively outside the repository:

- **Render** (current production host): Set environment variables in the Render dashboard per service (`API web service` and `Worker service`).
- **GitHub Actions** (if needed for integration tests): Use [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) (`Settings → Secrets and variables → Actions`).

Never copy production values into `package.json`, `.env` files committed to git, or CI `env:` sections.
