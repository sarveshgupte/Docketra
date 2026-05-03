# Local Testing Guide

How to run the Docketra test suites on a developer machine.

---

## Prerequisites

- Node.js 18.x and npm 9+
- Dependencies installed: `npm install && npm --prefix ui install`
- Backend `.env` configured (see [../deployment/environment-variables.md](../deployment/environment-variables.md))
- MongoDB running (for integration tests that hit a real DB)

---

## Backend tests

Backend tests live in `tests/` and are plain Node.js scripts (no test runner framework required). Most pure tests do **not** require a running MongoDB or Redis — they use in-memory mocks.

### Quick: run all pure tests (no DB/Redis required)

```bash
npm run test:pure
```

This runs integrity, security, hardening, and tenant boundary tests with `REDIS_URL=''` and `ALLOW_REDIS_FALLBACK=true`.

### Integration tests (requires MongoDB)

```bash
npm run test:integration
```

Runs admin integrity and encryption migration tests against a real MongoDB instance.

### Test categories

| Command | Coverage |
|---------|---------|
| `npm run test:pure` | All pure tests (no external dependencies) |
| `npm run test:integration` | Integration tests (requires MongoDB) |
| `npm run test:integrity:pure` | Core integrity: health, RBAC, write safety, lifecycle, SLA, audit |
| `npm run test:security:pure` | Security: CSRF, session, auth middleware, rate limiting |
| `npm run test:hardening:pure` | Hardening: request IDs, production startup, backend entrypoints |
| `npm run test:tenant-identity-boundary` | Storage/tenant ownership boundary tests |
| `npm run test:admin-tenant-boundary` | Admin tenant boundary isolation |
| `npm run test:byos` | BYOS storage provider tests |
| `npm run test:auth-pilot-smoke` | Auth pilot smoke: forgot password, cookie flow, superadmin session |

### Syntax check (lint)

```bash
npm run lint
```

Checks all `.js` files in `src/` and `tests/` for syntax errors.

### Environment validation

```bash
npm run validate:env
```

Validates required environment variables using the current `.env`.

### Route validation

```bash
# Validate route contracts and mount order
npm run ci:backend:routes
```

---

## Frontend tests

Frontend tests live in `ui/tests/` and are static analysis tests written as `.mjs` files. They inspect component and route structure without a browser or jsdom.

### CI test suite (17 tests)

```bash
npm --prefix ui run test:ci
```

This is the standard CI check. It includes:

- `test:dockets-route` — dockets route reliability
- `test:navigation` — navigation reliability
- `test:forms` — form reliability hardening
- `test:auth-refresh-loop` — auth refresh loop regression
- `test:routing-public-boundary` — public/private routing boundary
- `test:admin-surface` — admin surface hardening
- `test:docket-surface` — docket surface hardening
- `test:queue-ux-consistency` — queue UX consistency
- `test:reports-dashboard-states` — reports dashboard loading states
- `test:design-system-contract` — design system contract
- `test:storage-service-contract` — storage service contract
- `test:superadmin-routes` — superadmin route suspense
- `test:auth-reliability-routes` — auth reliability route guards
- `test:case-detail-performance` — case detail performance refactor
- `test:case-detail-architecture` — case detail architecture smoke
- `test:superadmin-screen-reliability` — superadmin screen reliability
- `test:work-type-normalization` — work type normalization

### Additional workspace tests

```bash
npm --prefix ui run test:shells          # workspace shell unification
npm --prefix ui run test:sidebar-active  # sidebar active state reliability
npm --prefix ui run test:command-center  # command center contract
```

### Frontend build check

```bash
npm --prefix ui run build
```

A successful Vite build is a required gate before any release.

---

## Full CI release gate (local)

Run the full release gate locally to match what CI checks:

```bash
npm run ci:release-gate
```

This runs:
1. Backend syntax check (`npm run lint`)
2. Route validation
3. Backend core tests (pure)
4. Backend security and hardening tests (pure)
5. Frontend build
6. Frontend test suite (`test:ci`)

For the integration variant (requires MongoDB):

```bash
npm run ci:release-gate:integration
```

---

## Pilot readiness gate

```bash
npm run test:pilot-readiness
```

Runs route validation, auth pilot smoke tests, tenant boundary tests, pure backend tests, and the full frontend build + test suite.

---

## Tips

- Set `REDIS_URL=''` and `ALLOW_REDIS_FALLBACK=true` when running pure tests locally without Redis.
- Set `NODE_ENV=test` to suppress some production-only checks.
- Use `npm run validate:env:test` to validate env variables with test-mode defaults.
- For MongoDB-dependent tests, ensure your `MONGO_URI` points to a test database, not production data.
