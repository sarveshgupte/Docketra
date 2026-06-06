# Secret Scanning Gate

Docketra enforces a CI secret scanning gate to prevent accidental commits of credentials.

## What is blocked

The gate is configured with `gitleaks` and is intended to fail PRs/commits that contain secret-looking values, including:

- API keys and storage tokens
- JWT and OAuth secrets
- MongoDB URIs and Redis URLs with real credentials
- SMTP credentials
- Private keys

## CI enforcement

Secret scanning runs on:

- `pull_request`
- `push` to `main`

Workflow: `.github/workflows/secret-scanning.yml`

## Local usage

Run the same gate locally before opening a PR:

```bash
npm run security:secrets
```

This command runs `scripts/run-secret-scan.sh`, which uses local `gitleaks` if available and otherwise downloads a pinned version.

## Safe examples and placeholders

Only safe example files are allowlisted:

- `.env.example`
- `.dev.vars.example`

These files must use placeholder values (e.g. `<required-...>`, `example`, `placeholder`). Real secret-like values in tracked files will fail the gate.

## Never commit local env files

- Do not commit `.env`, `.env.local`, `.env.*`, or real Cloudflare/worker vars files.
- Store real credentials in secure environment-variable stores (e.g. Render, Cloudflare dashboard, GitHub Actions secrets).

## If a secret leaks

1. **Rotate immediately** in the upstream provider (DB, SMTP, OAuth, storage, etc.).
2. **Revoke old credentials** and issue new values.
3. **Update runtime secrets** in deployment/CI secret stores.
4. **Invalidate sessions/tokens** if the leaked value signs auth artifacts.
5. **Open an incident note** documenting scope, rotation timestamp, and remediation owner.
6. **Verify cleanup** by rerunning `npm run security:secrets` and ensuring CI passes.
