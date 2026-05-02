# Release Gate and Test Execution Matrix

This document defines which backend checks are **pure** (no external runtime services), which are **integration** (Mongo/Redis runtime required), and which validate **environment policy**.

## Commands to run before merge

## Command to run before manual pilot QA (dummy data only)

Run this as a single smoke gate before starting founder/operator manual QA flows:

```bash
npm run test:pilot-readiness
```

This command is intentionally **pure-first** and does not require external MongoDB/Redis services. It covers:
- backend route validation + mount order contracts
- auth pilot smoke coverage (firm + superadmin session/login regressions)
- tenant/admin boundary enforcement checks
- full pure hardening/security/core test gate
- frontend build + frontend CI checks

What it does **not** cover:
- Mongo runtime integration checks (`test:integrity:integration`)
- any test requiring real external infrastructure

If you also want integration confidence, run:

```bash
npm run test:pilot-readiness:integration
```

Use `ci:release-gate:pure` as the **merge/release blocker** and `test:pilot-readiness` as the **pre-manual-QA operator command**.

### Required merge blockers (pure gate)
Run this first for PR safety in local/Codex/CI:

```bash
npm run ci:release-gate:pure
```

This includes:
- syntax/lint checks
- route validation contract tests
- route mount order contract tests
- core backend pure tests (including tenant/admin boundary tests)
- security and hardening test suites
- test/production env schema validation checks
- frontend build/checks

### Required merge blockers (integration gate)
Run this when the PR touches DB-dependent backend behavior:

```bash
npm run ci:release-gate:integration
```

This currently runs integration tests that use `mongodb-memory-server` and a live in-process Mongo runtime.

## Test categories

### Pure tests (no external services)
Command:

```bash
npm run test:pure
```

Characteristics:
- must not require local Redis server
- must not require local MongoDB server
- should run in Codex/CI without Docker/services
- may mock Redis/Mongo modules, but no external network dependency

### Integration tests (runtime dependencies)
Command:

```bash
npm run test:integration
```

Characteristics:
- currently uses `mongodb-memory-server` (downloads/uses MongoDB binary as needed)
- can fail in locked-down/no-network environments if Mongo memory binary is unavailable

## Environment validation

### Test env validation
```bash
npm run validate:env:test
```
Validates test-mode required variables with test-safe defaults.

### Production env validation
```bash
npm run validate:env:production
```
Validates production policy constraints (secrets, token lengths, URI formats, strict flags).

## Runtime dependency mapping

### Redis-required tests
- Current release-gate scripts keep Redis-dependent behavior in **pure suites only when Redis is mocked or fallback-safe**.
- If a future test requires a real Redis instance, it must be moved under an explicit `:integration` script.

### MongoDB-required tests
- `test:integrity:integration` includes tests that run against `mongodb-memory-server`.
- These are separated from `test:integrity:pure` to avoid noisy failures in environments without Mongo memory binary availability.

### Production secrets/env policy
- `validate:env:production` is intentionally strict and remains a merge blocker.
- Failures here are security/policy blockers, not flaky infra noise.

## Local setup for integration tests

If integration tests fail due to Mongo memory runtime:
1. Ensure outbound network is available for initial `mongodb-memory-server` binary download; or
2. Pre-cache Mongo binaries per `mongodb-memory-server` docs; and
3. Re-run:
   ```bash
   npm run ci:release-gate:integration
   ```

A local Redis service is **not currently required** by the split integration gate scripts.

## How Codex should report env-only failures

When reporting results:
- Mark failures from `validate:env:*` as **environment policy failures** (merge blocker).
- Mark failures from `ci:release-gate:integration` caused by Mongo memory binary/download/service availability as **integration environment failures**.
- Mark failures from pure commands as **code/test regressions** (merge blocker).

## Merge blocker policy

A PR is merge-ready when all applicable checks pass:
1. `npm run ci:release-gate:pure` (**always required**)
2. `npm run ci:release-gate:integration` (**required for backend/data-path changes**)

For docs-only/UI-only/backend-non-data changes, integration gate may be waived by reviewer judgment, but pure gate and env validation remain required.
