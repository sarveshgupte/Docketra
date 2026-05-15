# AGENTS.md

## Scope

This file captures the current repo-specific commands and workflows that agents should prefer when working in Docketra. Keep changes minimal and grounded in `package.json`, CI, and the docs under `docs/`.

## Runtime shape

- Backend API entrypoint: `npm start` or `npm run dev` (`src/server.js`).
- Frontend dev server: `npm --prefix ui run dev`.
- Worker runtime: `npm run start:worker` (`src/worker.js`).
- Do not treat the API process as the worker process. Worker scheduling and background jobs belong to the worker runtime.

## Install and build

From repo root:

```bash
npm install --include=dev
npm --prefix ui install --include=dev
npm --prefix ui run build
```

Use `npm run build` when you want the repo's full install + UI build path.

## Preferred verification flow

For pre-PR or broad regression checks, prefer the CI-aligned sequence documented in `docs/operations/ci-release-gates.md`:

```bash
npm run ci:backend:syntax
npm run ci:backend:routes
npm run ci:backend:core
npm run ci:backend:security
npm run ci:frontend:install
npm run ci:frontend:build
npm run ci:frontend:checks
```

- `npm run ci:release-gate` is the fastest single-command equivalent when a full local gate is appropriate.
- `npm run ci:backend:routes` runs `tests/routeValidationContract.test.js`; use it when touching route schemas or validation coverage.
- `npm run ci:backend:security` includes env-contract validation plus backend security and hardening suites.

## Focused test commands

- Backend full suite: `npm run test`
- Frontend reliability bundle: `npm --prefix ui run test:ci`
- Public routing/auth boundary regression: `npm --prefix ui run test:routing-public-boundary`
- Auth refresh loop regression: `npm --prefix ui run test:auth-refresh-loop`
- Admin surface regression: `npm --prefix ui run test:admin-surface`
- Docket detail reliability checks: `npm --prefix ui run test:case-detail-performance` and `npm --prefix ui run test:case-detail-architecture`

## Environment and deployment checks

- Local env validation: `npm run validate:env`
- Production-style env contract: `npm run validate:env:production`
- Active deployment target is Render; API and worker are separate services.
- Post-deploy health checks documented in `docs/deployment/render-deployment.md`: `GET /health` and `GET /api/health`
