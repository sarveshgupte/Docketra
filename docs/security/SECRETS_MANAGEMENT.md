# Secrets Management and Rotation

## Incident note (May 2026)
A historical repository file previously exposed a MongoDB URI. The credential was remediated by rotating the MongoDB database user secret and updating production environment variables before redeploy. No prior URI value is retained in this document.

## Rules
- Never commit `.env` or other local secret files.
- Use hosted environment-variable stores (Render, Vercel, GitHub Actions secrets) for all production credentials.
- Treat any Git history exposure as a credential compromise and rotate immediately.
- Deleting `.env` from the current branch is not sufficient if the value existed in Git history.

## Required handling workflow
1. Add new secret values only through platform environment-variable settings.
2. Keep `.env.example` placeholder-only for local setup documentation.
3. Run local secret scanning before opening a PR.
4. Ensure CI secret scanning passes before merge.

## MongoDB Atlas rotation (high-level)
1. Create a new Atlas database user or reset the existing user password.
2. Update the application connection string in Render (and any other runtime environment).
3. Redeploy and verify application health.
4. Invalidate/decommission old credentials.
5. Review logs/alerts for unexpected authentication attempts.

## Local secret scanning
- Run `npm run security:secrets`.
- The command uses gitleaks with repository config in `.gitleaks.toml`.
- CI runs equivalent scanning and fails the build if findings are detected.

## Additional guidance
- Do not store API keys, OAuth secrets, SMTP credentials, private keys, access tokens, or production-like passwords in tracked files.
- For tests, use clearly non-production dummy values and placeholders only.
