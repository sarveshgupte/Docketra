# Docketra Private Pilot Bug Audit — May 2026

## Scope
Manual code-and-test audit focused on private-pilot stability for:
- auth/session
- role hierarchy and route access boundaries
- client management and CFS flows
- docket/task lifecycle surfaces
- storage/BYOS safety
- public route/header consistency
- error-handling and secret-leak regressions

## Bugs found and fixed
1. **Stale onboarding refresh trigger path (`/admin/clients`) in frontend mutation watcher**
   - Symptom: onboarding progress refresh hook watched a legacy admin-client path instead of canonical client route namespace.
   - Risk: client mutations through canonical `/clients` path may not trigger onboarding progress refresh consistently.
   - Fix: replaced `^/admin/clients` pattern with `^/clients` in onboarding mutation path patterns.
   - Regression test updated to validate canonical `/clients` trigger behavior.

## Files changed
- `ui/src/utils/onboardingProgressRefresh.js`
- `ui/tests/onboardingProgressRefresh.test.mjs`

## Tests added/updated
- Updated `ui/tests/onboardingProgressRefresh.test.mjs` sample matrix to assert refresh on `POST /clients` (canonical path) instead of stale `/admin/clients`.

## Commands run
- `rg --files -g 'AGENTS.md'`
- `find .. -name AGENTS.md -print`
- `rg -n "(/admin/clients|body\.name|Admin access required|Math\.random|localStorage|passthrough\(|privateKey|token|secret)" src ui/src tests`
- `node tests/onboardingProgressRefresh.test.mjs` (from `ui/`)
- `REDIS_URL='' ALLOW_REDIS_FALLBACK='true' node tests/clientManagementPermissionsAndSchema.audit.test.js`
- `REDIS_URL='' ALLOW_REDIS_FALLBACK='true' node tests/clientCfsUploadIntent.regression.test.js`
- `REDIS_URL='' ALLOW_REDIS_FALLBACK='true' node tests/routeMountOrderContract.test.js`

## Remaining known limitations
- Some broader multi-test chained runs can produce noisy transient DNS/Redis lookup logs in this environment when a test bootstraps runtime without `REDIS_URL=''` override. Targeted pilot-readiness tests were rerun with explicit Redis fallback env to keep results deterministic.
- This pass intentionally avoids feature expansion and only applies a scoped stabilization fix.

## Private pilot readiness status
**Status: Ready with minor caveat addressed.**

Rationale:
- Critical stale client mutation refresh route mismatch fixed.
- Regression coverage updated.
- Core route/schema and client CFS intent safety checks executed successfully in this pass.
