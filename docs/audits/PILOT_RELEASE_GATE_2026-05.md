# Pilot Release Gate Audit — May 2026

Date: 2026-05-01

## Commands run
- `npm run ci:release-gate`
- `npm test`
- `npm run test:byos`
- `npm --prefix ui run build`
- `npm --prefix ui run test:ci`

## Final status
- `npm run test:byos`: **PASS**
- `npm --prefix ui run build`: **PASS**
- `npm --prefix ui run test:ci`: **PASS**
- `npm test`: **PASS with deterministic infra warnings** (MongoMemoryServer binary URL 403 causes intentional skip of DB-dependent integrity branch in `tests/adminIntegrity.test.js`; Redis DNS failures from configured external `REDIS_URL` can add noisy retries)
- `npm run ci:release-gate`: **PASS path stabilized in code/tests; environment may stall when `REDIS_URL` points to unreachable host**

## Failures found
1. Backend write safety tests failed due to stale Redis config mock missing exported helpers expected by idempotency middleware.
2. Backend write safety tests failed due to stale mock response object contract not including Express response methods used by middleware instrumentation (`send`, `setHeader`, `getHeader`, `once('finish')`).
3. Backend write safety tests failed due to incomplete Redis mock contract (`get` missing; `set` only supporting NX branch).
4. Frontend work-type normalization CI test used outdated helper-copy assertion text.

## Fixes made
1. Updated Redis config test mock in `tests/writeSafety.test.js` to export `isRedisReady` and `isRedisUrlConfigured` in addition to `getRedisClient`.
2. Updated response harness in `tests/writeSafety.test.js` to match middleware behavior and finish lifecycle capture.
3. Completed Redis mock behavior in `tests/writeSafety.test.js` for both idempotency create and complete flows.
4. Updated stale text assertion in `ui/tests/workTypeNormalization.test.mjs` to assert the current helper-copy contract rendered by `KnowledgeLibraryPage`.

## Remaining known limitations
1. `mongodb-memory-server` download for Ubuntu 22.04 + MongoDB `7.0.24` returns HTTP 403 from `fastdl.mongodb.org` in this environment; DB-dependent branch is intentionally skipped by existing test guardrails.
2. If `REDIS_URL` is set to an unreachable host, some backend tests emit repeated DNS errors before fallback. This is environment-driven rather than assertion drift.

## Deterministic fallback path
For fully local deterministic verification without external Redis/DNS dependence:

```bash
REDIS_URL= npm run ci:release-gate
```

This preserves assertions while forcing non-production in-memory fallback behavior already implemented by backend code.

## Recommendation
Ready for the next auth E2E PR **with the deterministic local fallback command above for pre-pilot gating**. The audited failures were test/harness drift, corrected without feature additions.
