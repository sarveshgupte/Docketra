# CI Release Gates for Pull Requests

This document defines the required release gates for every pull request in Docketra.

## Why these gates exist

The gate sequence is intentionally focused on critical failure modes:

- backend syntax/lint breakage;
- route validation/schema drift;
- core backend behavior regressions;
- frontend build breakage;
- frontend route/navigation/form hardening regressions;
- config and security hardening drift.

The checks run only with open-source tooling already used in this repo and do not require paid external services.

## Local pre-PR commands (run exactly in this order)

From repository root:

```bash
npm install --include=dev
npm run ci:backend:syntax
npm run ci:backend:routes
npm run ci:backend:core
npm run ci:backend:security
npm run ci:frontend:install
npm run ci:frontend:build
npm run ci:frontend:checks
```

## Script map (local == CI)

### Backend

- `npm run ci:backend:syntax`  
  Runs backend syntax validation across `src/` and `tests/`.

- `npm run ci:backend:routes`  
  Runs route validation contract coverage (`tests/routeValidationContract.test.js`) to catch missing/stale route schemas and non-validated routes.

- `npm run ci:backend:core`  
  Runs the core backend test suite (`test:integrity`).

- `npm run ci:backend:security`  
  Runs environment contract validation and backend security/hardening test suites.

### Frontend

- `npm run ci:frontend:install`  
  Installs UI dependencies including dev dependencies.

- `npm run ci:frontend:build`  
  Validates production UI bundle build.

- `npm run ci:frontend:checks`  
  Runs focused UI reliability checks (`ui` test scripts aggregated under `test:ci`).

## GitHub Actions workflow

Workflow file: `.github/workflows/ci.yml`

The workflow is split into two parallel jobs for speed:

- **Backend release gate**
- **Frontend release gate**

A PR is considered merge-ready only when both jobs pass.

## Actionable failure output

Each gate is an independent CI step to keep failure output actionable:

- the failing gate name identifies the broken quality dimension immediately;
- the failing npm script prints the exact failing test/assertion;
- route/schema contract failures include missing key names and file paths.
