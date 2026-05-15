# Workspace Post-Login and Docket Lifecycle Hardening Audit (May 2026)

## Scope audited
- Post-login/default routing behavior for firm vs superadmin users.
- Firm sidebar primary navigation exposure and dashboard compatibility handling.
- Task-manager lifecycle and reports posture reviewed against current implementation/docs.
- Cloud-storage data-boundary posture reviewed at model layer.

## Current routes audited
- `ui/src/contexts/AuthContext.jsx` post-auth route resolver.
- `ui/src/components/routing/DefaultRoute.jsx` auth-resolved default route.
- `ui/src/routes/ProtectedRoutes.jsx` `/app/firm/:firmSlug/dashboard` compatibility route.
- `ui/src/components/common/Layout.jsx` firm sidebar item visibility and role-gated report visibility.

## Role nav matrix (implemented in this hardening)
- Admin / Primary Admin: Worklist-first entry, Reports visible, dashboard no longer primary.
- Manager: Worklist-first entry, Reports visible.
- Employee: Worklist-first entry, reports remain restricted.
- SuperAdmin: unchanged, continues to `/app/superadmin`.

## Docket lifecycle matrix (status)
- Existing lifecycle behavior retained; this PR focuses on route/nav hardening and guard coverage.
- No risky lifecycle migration introduced in this patch.

## Reports access matrix (status)
- Admin/Primary Admin: retain reports access.
- Manager: reports visibility enabled in firm sidebar.
- Employee: no broad reports nav exposure.

## Cloud-storage boundary findings
### MongoDB collections currently carrying business/workspace semantics (follow-up required)
- `Case`, `Client`, `Category`, `DocketActivity`, `DocketAudit`, attachment metadata models.
- These are business-plane entities and should remain cloud-canonical in target-state architecture.

### Allowed control-plane examples
- `User`, `Firm`, auth/session/audit identity and storage-provider configuration metadata models.

### Exceptions / transitional posture
- Current codebase still contains legacy business-plane Mongo models. Follow-up migration plan required; no unsafe migration performed in this PR.

## Bugs found
1. Firm users defaulted to dashboard after auth resolution.
2. `/app/firm/:firmSlug/dashboard` stayed as a functional workspace page instead of compatibility redirect.
3. Manager report surface was hidden in primary sidebar.

## Fixes applied
1. Firm post-auth resolver now targets Worklist.
2. Default route now sends authenticated firm users to Worklist, preserving SuperAdmin destination.
3. Dashboard firm route now redirects to Worklist for backward compatibility.
4. Sidebar updated to remove dashboard-first primary section and to expose Reports to managers.

## Tests added
- `tests/worklistFirstRouting.guard.test.js` validates:
  - Firm auth resolver uses Worklist.
  - Default route uses Worklist for firm users and SuperAdmin dashboard for superadmins.
  - Dashboard compatibility route redirects to Worklist.

## Remaining risks
- Direct assigned workbasket deep-link generation and full role/access matrix coverage still require focused UI/API tests.
- Full lifecycle permission and audit immutability e2e coverage remains broader than this patch.
- Cloud-canonical enforcement for all business entities needs staged migrations and repository-level storage contracts.

## Suggested follow-up PRs
1. Sidebar deep-link rendering for assigned primary/QC workbaskets (`/workbaskets/:id`, `/qc-workbaskets/:id`) with route guards.
2. Worklist “Show active dockets only” explicit UI+API contract tests.
3. Routed-docket resolve/file restriction e2e test suite.
4. Source-guard tests that block new business-plane Mongo model additions without explicit waiver docs.

## Readiness score
- **7.2/10** for the scoped hardening delivered here (routing/nav). Higher score pending lifecycle+storage contract completion.


## 2026-05-15 Update: Direct assigned queue links

- Implemented direct sidebar links for assigned primary workbaskets and assigned QC workbaskets (role and assignment scoped).
- Added dedicated direct routes for queue access with route guards to prevent unauthorized access to workbasket/QC deep links.
- Kept Worklist-first flow intact while removing generic workbasket filter-first dependence for assigned users.
