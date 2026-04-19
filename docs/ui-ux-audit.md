# Docketra UI/UX audit and improvement pass (April 2026)

## Scope

This pass focused on high-impact reliability and trust issues in authentication and protected navigation, where users were most likely to lose context or hit dead ends.

## Key issues found

| Severity | Area | Issue | Impact |
| --- | --- | --- | --- |
| High | Auth + protected routes | Intended destination was not preserved when an unauthenticated user was redirected to login. | Users landed on generic dashboards after login instead of the page they were trying to open. |
| High | Auth security/UX | No reusable return-path sanitation utility existed for login redirects. | Risk of inconsistent redirect behavior and potential future open-redirect mistakes. |
| Medium | Firm route guard | Cross-firm access denial screen had no direct recovery actions. | Dead-end experience and additional clicks/confusion for users operating across firm URLs. |

## Fixes implemented

### 1) Preserved intended route across auth redirects

- Added `buildReturnTo` + `appendReturnTo` helpers.
- Protected route guard now appends a validated `returnTo` query param to login redirects.
- Login flows now honor `returnTo` after successful auth, falling back to role-aware default route.

### 2) Standardized secure post-login redirect logic

- Added a centralized redirect utility (`resolvePostLoginDestination`) that only allows internal `/app...` paths.
- Both superadmin and firm login screens now use the same redirect resolution behavior.

### 3) Improved cross-firm access denial recovery

- Enhanced the firm mismatch screen with explicit actions:
  - **Go to dashboard** (safe in-session route)
  - **Switch workspace** (firm login route)
- Added keyboard-visible focus styles for these critical actions.

## UX principles reinforced

1. **Never lose user intent:** preserve destination when auth interrupts navigation.
2. **Safe-by-default redirects:** only allow known internal app paths.
3. **No dead ends:** every guard/failure state should provide a clear next action.
4. **Consistency over custom logic:** shared helpers for cross-cutting route behavior.

## Remaining follow-up opportunities

1. Add automated browser-level coverage for login → returnTo flows across both superadmin and firm login.
2. Standardize all non-auth guard pages to include structured recovery actions.
3. Consolidate route-level loading/error patterns into a single shell contract for all major modules.

## Navigation and route reliability pass (April 2026)

### Root issues found

| Severity | Area | Issue | Impact |
| --- | --- | --- | --- |
| High | Sidebar navigation | QC Queue pointed to a filtered dockets URL instead of the dedicated queue route. | Users hit inconsistent behavior and lost confidence about where QC actions should happen. |
| High | Role-aware navigation | Reports links were visible in shell contexts even when route access required admin permissions. | Users could click into authorization-blocked destinations with no clear value. |
| Medium | Route consistency | Sidebar mixed route construction styles (literal strings vs route constants). | Increased risk of drift and broken links as paths evolve. |
| Medium | Shell usability | Many pages lacked explicit in-shell page context/title in the legacy shell. | Navigation felt jumpy and users had less orientation confidence. |
| Medium | Core shortcuts | Dashboard module shortcuts included admin-only routes for all roles. | Non-admin users encountered avoidable dead-end clicks. |

### Core fixes implemented

1. **Navigation reliability hardening**
   - Updated sidebar QC link to the canonical `/qc-queue` route.
   - Unified client navigation links to `ROUTES.CLIENTS(...)`.
   - Added admin gating for Insights/Reports and preserved role-safe visibility.
   - Added a `Settings Hub` entry in admin navigation for consistency with `/settings`.

2. **Route consistency and shell context**
   - Replaced manual reports route string usage with `ROUTES.ADMIN_REPORTS(...)`.
   - Added optional page title/subtitle context block in the main enterprise shell (`Layout`) so major pages can present clear context.
   - Improved `PlatformShell` active-nav detection for nested routes and added breadcrumb context for orientation.
   - Added dynamic document title updates in `PlatformShell`.

3. **Interaction confidence improvements**
   - Added QC Queue command palette shortcut where role access allows it.
   - Updated dashboard shortcuts so CMS/CRM/Reports are only shown when the user has admin permissions.
   - Added clear “admin required” hint text when privileged modules are hidden.

4. **Automated QA coverage**
   - Added `ui/tests/navigationReliability.test.mjs`.
   - Verifies primary sidebar route generation integrity.
   - Verifies no placeholder routes are included.
   - Verifies core protected route entries exist in `ProtectedRoutes` and firm routes are rendered in the firm shell.

### Core interaction QA pass checklist

- [ ] Login and confirm landing on dashboard.
- [ ] Navigate every primary sidebar item (Dashboard, Tasks, Workbasket, Worklist, QC Queue where allowed, Clients, CRM, CMS, Reports, Team, Settings, Profile).
- [ ] Open at least one secondary route per module (e.g., dockets detail, CRM client detail, report detail, settings subsection).
- [ ] Verify no primary visible button/link is a dead click on dashboard, worklist, workbaskets, QC queue, CRM, CMS, reports, and settings.
- [ ] Verify browser back/forward behavior across dashboard → module → detail flows.
- [ ] Verify loading, empty, and error table states are human-readable across platform pages.
- [ ] Verify admin-only routes are not exposed to non-admin users in navigation shortcuts.

## Manual QA checklist

- [ ] Visit a protected URL while logged out and confirm redirect to login with preserved destination.
- [ ] Login via firm route and verify return to original protected URL.
- [ ] Login via superadmin route and verify return to original protected URL.
- [ ] Force session expiry and confirm informative sign-in messaging appears.
- [ ] Hit firm mismatch URL and verify **Go to dashboard** and **Switch workspace** both work.
- [ ] Confirm back/forward navigation around login does not create redirect loops.
- [ ] Validate keyboard focus visibility on firm mismatch action buttons.

## Create and edit flow reliability pass (April 2026)

### Root form UX issues found

| Severity | Area | Issue | Impact |
| --- | --- | --- | --- |
| High | Docket create | Limited form-level feedback and inconsistent validation language across steps. | Users could miss why create failed and lose confidence in required inputs. |
| High | Client create/edit modal | Required fields had only toast-level validation and modal close paths discarded edits. | Accidental data loss risk and unclear error recovery path. |
| Medium | Modal close behavior | ESC/overlay/close icon had no interception hook for dirty forms. | Critical form work could be lost silently. |
| Medium | Save-state confidence | Some flows lacked explicit in-form saving state and stable error banner area. | Users depended on transient toasts and could retry too quickly. |

### Flows/modules touched

- Create docket guided form (`GuidedDocketForm`) and create docket page wiring.
- Client create/edit modal form on `ClientsPage`.
- Shared modal close contract (`Modal`) for guarded close behavior.
- Shared unsaved-changes hook (`useUnsavedChangesPrompt`) for form-level data-loss protection.

### Validation improvements made

1. Added stronger create-docket step validation messages (title length, client requirement, category/subcategory compatibility, workbasket requirement).
2. Added client modal field-level validation map for required values + email format checks.
3. Added stable in-form error banner for both create-docket and client forms to supplement toast notifications.

### Save-state and recovery improvements made

1. Added explicit “Creating docket…” state banner during submit.
2. Added duplicate-submit guard in docket create (`if (loading.submit) return`).
3. Added dirty-form close protection for client modal (cancel, ESC, overlay, close icon).
4. Added beforeunload unsaved-work warning for critical create/edit interactions via shared hook.
5. Disabled client save when there are no changes, reducing accidental no-op writes.

### Unsaved changes rules adopted

- For create/edit forms marked dirty, closing the form now requires confirmation.
- Dirty interception is applied uniformly to button cancel and modal-system close events.
- Browser/tab close prompts appear when form work is dirty and unsaved.

### Remaining follow-up items

1. Expand the same dirty-close + validation banner pattern to team invite/edit, hierarchy role edits, and workbasket/category maintenance modals.
2. Add browser-level interaction tests (Playwright) for route transition blocking in dirty forms.
3. Standardize server-side field error mapping format for all admin/settings forms.

### Manual QA checklist — create/edit reliability pass

- [ ] Create docket: required validation blocks submit with clear field-level messages.
- [ ] Create docket: submit shows immediate saving state and no duplicate creation on repeated clicks.
- [ ] Create docket: server failure keeps entered values and shows clear in-form error.
- [ ] Create docket: cancel from dirty form asks for confirmation before leaving.
- [ ] Edit docket status/assignment: verify save/loading/error toasts and page state refresh (existing behavior).
- [ ] Create/edit client: required + email validation appears inline at field level.
- [ ] Create/edit client: save button disables when there are no unsaved changes.
- [ ] Create/edit client: ESC, overlay click, close icon, and cancel all protect against dirty-data loss.
- [ ] Invite/edit team member: verify save and error states remain clear (follow-up area for full pattern rollout).
- [ ] Update hierarchy tagging/roles: verify save, error, and post-save state consistency.
- [ ] Update workbasket/category/subcategory settings: verify required/dependency messaging and stable save feedback.
- [ ] Save profile/settings and AI/BYOS settings: verify saving/success/error states and no silent failures.
