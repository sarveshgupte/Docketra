# PR: Full docket workflow unification + remaining legacy firm-route migration

## 1) Root workflow inconsistencies found

- Dockets list and docket detail were still rendered in legacy `Layout`, while adjacent queue pages already used `PlatformShell`.
- Queue/list to detail transitions did not consistently preserve return context.
- Several high-traffic firm pages (Hierarchy, Profile, Compliance Calendar, CRM Leads, CRM Client Detail) still used legacy shell framing.
- `PlatformShell` top-right user pill did not provide a clear, discoverable sign-out path.

## 2) Docket-flow issues fixed

- Migrated dockets list (`/dockets`) and docket detail (`/dockets/:caseId`) to `PlatformShell`.
- Added list-to-detail continuity via `returnTo` context when opening docket detail from:
  - Dockets list
  - My Worklist
  - Workbaskets
  - QC Queue
- Added explicit **Back to queue** action in docket detail that resolves:
  1. `location.state.returnTo`
  2. query `returnTo`
  3. fallback to canonical dockets list route.
- Preserved existing previous/next detail navigation and docket action behavior.

## 3) Routes migrated

- `/app/firm/:firmSlug/dockets`
- `/app/firm/:firmSlug/dockets/:caseId`
- `/app/firm/:firmSlug/admin/hierarchy`
- `/app/firm/:firmSlug/profile`
- `/app/firm/:firmSlug/compliance-calendar`
- `/app/firm/:firmSlug/crm/leads`
- `/app/firm/:firmSlug/crm/clients/:crmClientId`

## 4) Shell/page rules applied

- Reused existing `PlatformShell` pattern (no new shell introduced).
- Standardized module label/title/subtitle contract across migrated pages.
- Removed legacy `Layout` usage from the migrated pages listed above.
- Maintained browser title consistency through shell-level title behavior.

## 5) Logout visibility + behavior fix

### Root cause

`PlatformShell` rendered only a static user pill without a menu affordance or explicit logout action, unlike legacy `Layout`.

### Fix

- Added a keyboard-accessible account dropdown in `PlatformShell` with:
  - visible chevron affordance
  - menu semantics (`aria-haspopup`, `aria-expanded`, menu role)
  - outside-click and Escape close handling
  - clear **Sign out** action.
- Logout now:
  - calls AuthContext logout
  - preserves firm slug routing hint
  - redirects users to firm login (`/:firmSlug/login`) with success message state.

## 6) Tests added/updated

- Updated `ui/tests/firmWorkspaceShellUnification.test.mjs`:
  - asserts migrated routes/pages now use `PlatformShell`
  - asserts legacy `Layout` is absent in migrated pages.
- Updated `ui/tests/docketsRouteReliability.test.mjs`:
  - aligns docket shell expectations to `PlatformShell`
  - checks queue->detail continuity marker usage.
- Added `ui/tests/docketWorkflowUnification.test.mjs`:
  - verifies `PlatformShell` logout menu/sign-out behavior hooks
  - verifies continuity safeguards (`returnTo`, back-to-queue) across docket workflows.

## 7) Manual QA checklist

- [ ] Dashboard → Dockets opens in unified shell.
- [ ] Dockets list → Docket detail → Back to queue preserves route context.
- [ ] Filtered dockets list → Docket detail → Back retains filter/search context where available.
- [ ] Worklist row → Docket detail retains return context.
- [ ] Workbasket row → Docket detail retains return context.
- [ ] QC queue row → Docket detail retains return context.
- [ ] Create docket flow still lands in expected destination route.
- [ ] Client workspace → docket detail route remains stable.
- [ ] Profile / Hierarchy / Compliance Calendar / CRM Leads / CRM Client Detail now feel part of same workspace shell.
- [ ] No shell jumps between core daily operations pages.
- [ ] Key docket actions still show loading/success/error feedback.
- [ ] Dashboard top-right account menu is clearly clickable and reveals **Sign out**.
- [ ] Logout from dashboard/clients/reports/settings redirects to firm login and session is cleared.
- [ ] Browser back after logout does not re-open protected pages.

## 8) Documentation updates

- Updated `docs/ui-ux-audit.md` with:
  - `Core docket workflow unification pass (April 2026)`
  - `Remaining legacy route migration pass`
  - logout discoverability root cause/fix details.
- Updated `docs/whats-new.md` with shipped product update summary for this UX improvement.
