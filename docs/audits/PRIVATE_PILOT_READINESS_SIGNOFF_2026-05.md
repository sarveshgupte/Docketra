# Docketra Private Pilot Readiness Signoff — May 2026

Date: 2026-05-07
Scope: Task Manager-only private pilot readiness gate (firm users), with superadmin boundary preserved and managed storage fallback available.

## Commands Run

1. `npm test`
2. `npm run lint`
3. `npm run validate:env:test`
4. `npm run validate:env:production`
5. `npm run test:pilot-hardening`
6. `npm run ci:backend:routes`
7. `npm run ci:frontend:build`
8. `npm --prefix ui run test:ci`
9. `node tests/privatePilotSmoke.test.js`

## Pass/Fail Summary

| Command | Status | Notes |
|---|---|---|
| `npm test` | PASS after fixes | firm RBAC cache path and pending reopen canonical/audit alignment fixed |
| `npm run lint` | PASS | syntax/lint checks passed |
| `npm run validate:env:test` | PASS | test env contract valid |
| `npm run validate:env:production` | PASS | production env contract valid |
| `npm run test:pilot-hardening` | PASS | route/auth/UI pilot guardrails passed |
| `npm run ci:backend:routes` | PASS | route schema + mount order passed |
| `npm run ci:frontend:build` | PASS | Vite build passed |
| `npm --prefix ui run test:ci` | PASS | full UI reliability suite passed |
| `node tests/privatePilotSmoke.test.js` | PASS | focused pilot smoke checks passed |

## Security/Workflow Invariants Confirmed

- Authorization freshness protection is retained: request-cached role context is revalidated against fresh firm membership before final permission allow/deny.
- Canonical reopen workflow remains: due pending dockets persist to `state=IN_WB`/`queueType=GLOBAL` (unassigned) while canonical audit emits `toState=AVAILABLE`.

## Known Non-Blockers

- NPM logs emit `Unknown env config "http-proxy"` warnings; tests/builds still pass and no pilot flow impact observed.
- CRM/CMS/Company Brain codepaths still exist in repository, but pilot hardening and launch readiness tests passed for task-manager-focused launch behavior.

## Remaining Pilot Blockers

- Manual production environment access is required for human/UI smoke evidence capture (Render/Vercel deployment URLs and pilot credentials were not available in this execution environment).

## Manual QA Status

- Automated QA: Completed (all listed commands passed).
- Manual production QA: Evidence scaffold completed; execution against deployed environment is pending release-owner runbook execution.

## Manual Production QA Evidence

### Date/Time (UTC)
- 2026-05-07 07:41 UTC

### Deployment Target
- Environment Name: **Production-like private pilot stack**
- Deployment URLs: **TBD by release owner at execution time**
- Notes: This repo update adds the final evidence template and decision gate; no app behavior changes are included.

### Test Accounts / Roles (No secrets)
- Firm user role: `USER` (pilot firm)
- Firm manager role: `MANAGER` (pilot firm)
- Firm admin role: `ADMIN` or `PRIMARY_ADMIN` (pilot firm)
- Superadmin role: `SUPERADMIN`
- Passwords/tokens: **not recorded**

### Manual Smoke Results Table

| Check | Result | Evidence/Notes |
|---|---|---|
| Firm login redirects to `/app/firm/:firmSlug/dashboard` | PENDING | Capture URL transition + dashboard landing screenshot |
| Create docket/task works | PENDING | Capture created docket ID/title |
| Docket appears in expected worklist/workbasket | PENDING | Capture queue/workbasket screenshot |
| Logout clears session + protected routes return to login | PENDING | Capture post-logout protected-route redirect |
| Firm user blocked from `/app/superadmin/*` | PENDING | Capture forbidden/redirect behavior |
| Superadmin blocked from firm-scoped routes | PENDING | Capture forbidden/redirect behavior |
| Storage settings work without BYOS | PENDING | Capture storage settings state |
| Managed storage fallback works | PENDING | Capture successful managed storage upload/use |
| Failed/aborted BYOS OAuth keeps managed fallback working | PENDING | Capture aborted OAuth + managed-mode continuation |
| Pending reopen returns docket unassigned to workbasket | PENDING | Capture docket state/queue after reopen |

### Screenshots Checklist
- [ ] Firm dashboard landing after login redirect.
- [ ] Docket creation success confirmation.
- [ ] Worklist/workbasket showing new docket.
- [ ] Logout then protected route redirect to login.
- [ ] Firm-user blocked from superadmin route.
- [ ] Superadmin blocked from firm-scoped route.
- [ ] Storage settings with BYOS optional + managed default.
- [ ] Managed fallback success after BYOS abort/failure.
- [ ] Pending reopen showing unassigned workbasket return.

> Do not commit screenshots unless repository policy explicitly allows binary evidence commits.

### Final GO/NO-GO Decision

**NO-GO (temporary gate hold)** until the above manual production smoke checklist is executed and marked PASS on deployed production-like infrastructure.

## Manual QA Checklist (Render API + Vercel UI, or Render-only)

1. Firm login with pilot user: verify redirect to `/app/firm/:firmSlug/dashboard`.
2. Create a new docket/task from dashboard quick action.
3. Verify docket appears in expected list (workbasket/worklist visibility by role).
4. Trigger logout; verify session cookies/token cleared and protected routes return to login.
5. Confirm firm user cannot enter `/app/superadmin/*`; confirm superadmin user cannot enter firm-scoped routes.
6. Open storage settings with no BYOS connection configured; verify managed storage mode is available and usable.
7. Optional BYOS connect flow: verify failed/aborted OAuth does not break managed fallback mode.
8. Run one reopen-from-pending scenario and confirm docket returns unassigned to workbasket.

## Private Pilot Exit Criteria (Exact)

Private pilot is **GO** only if all of the following are true:

1. All required automated commands in this signoff pass on the release candidate commit.
2. Manual QA checklist above passes in production-like deployment.
3. Firm navigation and post-login flow remain task-manager-first for pilot users.
4. Superadmin and firm route namespaces remain isolated.
5. Managed storage remains available as default fallback when BYOS is absent.

### Final Gate Decision

**NO-GO** until manual production smoke evidence is captured and all required checks are PASS in deployed environment.
