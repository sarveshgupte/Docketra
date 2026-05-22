# Pilot auth and routing smoke coverage

This document tracks the pilot-focused auth/routing smoke checks added for the Task Manager MVP surface lock.

## Purpose

Validate high-risk browser-style auth and route behavior without expanding product scope:

- SuperAdmin login/logout and pilot nav surface
- Firm login/logout and pilot nav surface
- Hidden non-MVP route gating behavior
- `/settings/work` allowlist behavior
- Session persistence after reload (no redirect loop)
- Mobile-shell auth/navigation baseline

## Test command

Run the targeted smoke contract test:

```bash
npm --prefix ui run test:pilot-auth-routing
```

Run the UI CI aggregate (includes this smoke test):

```bash
npm --prefix ui run test:ci
```

## Coverage map

The smoke contract lives in:

- `ui/tests/pilotAuthRoutingSmoke.test.mjs`

It asserts:

1. SuperAdmin login redirects to `/app/superadmin`, logout redirects to `/superadmin/login`, and pilot-visible nav labels remain visible while hidden labels remain behind pilot gating.
2. Firm login uses deterministic post-auth navigation and pilot-visible nav surfaces stay present.
3. Hidden non-MVP firm routes remain explicitly guarded, and `settings/work` remains explicitly reachable.
4. Session hydration/refresh-loop guards remain present in auth and protected route layers.
5. Logout clears private client cache and emits logout cleanup event.
6. Mobile breakpoint shell controls remain present for auth/navigation usability.

## Notes

- This is intentionally focused smoke coverage for CI speed and routing/auth regression detection.
- It is designed to catch contract drift introduced by refactors while preserving current product behavior.
