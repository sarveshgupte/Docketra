# Pilot Launch Readiness Gate

## What this gate checks

The pilot launch readiness gate is a fast, deterministic inventory guardrail that validates pilot-surface routing and workflow safety contracts:

- Pilot-visible firm navigation inventory (Task Manager MVP-only surfaces).
- Hidden/deferred module route gating via `PilotRouteGate`.
- Command/shortcut/quick-action destination safety for pilot users.
- SuperAdmin pilot navigation inventory (only pilot-safe platform controls).
- Lightweight frontend/backend pilot API route mount parity for core pilot workflows.

## Why hidden modules are intentionally blocked

Docketra pilot is intentionally scoped to Task Manager MVP to reduce operational and onboarding risk. Deferred modules (CRM, CMS, Company Brain, Knowledge Library, AI/Storage settings, reports, and related settings surfaces) stay blocked during pilot so:

- Teams do not accidentally enter incomplete/non-pilot workflows.
- Deep links to non-pilot routes fail closed back to pilot-safe paths.
- Future changes cannot silently re-expose hidden modules.
- Product and support readiness remain aligned with approved pilot scope.

## Commands to run locally

From repo root:

```bash
npm run test:pilot-launch-readiness
npm --prefix ui run test:ci
npm run docs:check
```

## How to update this gate when pilot scope intentionally changes

If a module or route is intentionally added to pilot:

1. Update pilot surface source-of-truth (`ui/src/constants/pilotSurface.js`) and routing behavior (`ui/src/routes/ProtectedRoutes.jsx`).
2. Update inventory assertions in:
   - `ui/tests/pilotLaunchReadinessInventory.test.mjs`
   - `tests/pilotLaunchReadinessApiParity.test.js` (if API/route-mount expectations change)
3. Update navigation/command destinations where needed (`ui/src/constants/platformNavigation.js`, `ui/src/components/common/Layout.jsx`, and/or superadmin layout).
4. Run:
   - `npm run test:pilot-launch-readiness`
   - `npm --prefix ui run test:ci`
   - `npm run docs:check`
5. Document the intentional pilot scope expansion in `docs/whats-new.md`.
