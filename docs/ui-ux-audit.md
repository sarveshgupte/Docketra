# Docketra UI/UX audit and improvement pass (April 2026)

## Task Manager execution-list unification pass (April 2026)

### Scope

- Unified queue behavior and interaction language across **Workbasket**, **My Worklist**, **QC Workbasket**, and **All Dockets**.
- Preserved queue-specific purpose while normalizing list architecture, filter ergonomics, row semantics, and state handling.

### Improvements shipped

1. **Shared execution-list pattern**
   - Queue pages now align on header framing, search/filter bar placement, and table structure.
   - Core scanning fields are now more consistent (docket ID, client, category/subcategory, status, assignee/owner, updated timestamp, queue context).

2. **State UX consistency**
   - All queue surfaces now consistently expose loading, background refresh notices, recoverable errors with retry, empty states, and filtered no-results messaging.

3. **Queue-to-docket context preservation**
   - Opening a docket from queue surfaces now preserves `sourceList`, active index, origin, and `returnTo` path.
   - Docket Detail Back and Previous/Next now behave more reliably against the user’s currently visible queue subset.

4. **Queue role clarity**
   - Workbasket: pooled shared work intake and pull actions.
   - My Worklist: personal execution actions.
   - QC Workbasket: review/approve/correct/fail actions.
   - All Dockets: oversight and broad tracking/search context.

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

## Firm workspace shell unification pass (April 2026)

### Shell decision

- Standardized major firm-facing routes on **`PlatformShell`** as the workspace shell contract.
- Kept `FirmLayout` as the route-guard/context wrapper only (firm scoping + outlet), while page-level UX chrome now converges on one shell system.

### Route-to-shell audit map (`/app/firm/:firmSlug/*`)

| Route | Page type | Previous shell | Target shell | Migration | UX inconsistency observed |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | Module landing | `PlatformShell` | `PlatformShell` | No | Baseline for desired shell language |
| `/dockets`, `/dockets/:caseId`, `/dockets/create` | Core docket list/detail/create | Mixed (`Layout` + `PlatformShell` for create) | phased | Partial (already in progress) | Context jump when moving between list/detail/create |
| `/clients` | Major list | `Layout` | `PlatformShell` | **Completed** | Legacy header/card composition vs modern workspace shell |
| `/clients/:clientId/*` | Detail workspace | `Layout` | `PlatformShell` | **Completed** | Detail flow felt like a separate product surface |
| `/worklist`, `/global-worklist`, `/qc-queue`, `/admin/reports`, `/settings` | Major module landings | `PlatformShell` | `PlatformShell` | No | Baseline for consistency target |
| `/admin` (Team) | Team management | `Layout` | `PlatformShell` | **Completed** | Team route looked legacy while adjacent modules were modern |
| `/settings/firm` | Settings detail | `Layout` | `PlatformShell` | **Completed** | Visual shell flip when opening from Settings hub |
| `/settings/work` | Settings detail | `Layout` | `PlatformShell` | **Completed** | Header and spacing mismatch vs Settings hub |
| `/storage-settings` | Settings detail | `Layout` | `PlatformShell` | **Completed** | Legacy page framing and title behavior mismatch |
| `/ai-settings` | Settings detail | `Layout` | `PlatformShell` | **Completed** | Legacy shell divergence from adjacent settings routes |
| `/crm/clients/:crmClientId`, `/crm/leads`, `/admin/hierarchy`, `/profile`, `/compliance-calendar` | Adjacent major/supporting routes | `Layout` | `PlatformShell` | Pending | Still create residual mixed-shell transitions |

### Page pattern rules adopted for migrated pages

1. Shell-level module context (`moduleLabel`) + unified workspace breadcrumbs.
2. Consistent page title + supporting subtitle via `PlatformShell` props.
3. Page-level action placement in shell action rail (where applicable).
4. Content framed in section cards/panels with stable spacing hierarchy.
5. Explicit loading/empty/error handling for high-traffic list/settings surfaces.
6. Browser document title managed consistently by `PlatformShell`.

### Key migration outcomes

- Migrated **Clients list** and **Client workspace detail** to `PlatformShell`.
- Migrated **Team (`/admin`)** to `PlatformShell` while preserving category-management context behavior.
- Migrated major **settings detail surfaces** (`/settings/firm`, `/settings/work`, `/storage-settings`, `/ai-settings`) to `PlatformShell`.
- Added intentional client-list error recovery UI with a clear retry action, replacing toast-only failure handling.

### Remaining migration candidates (next pass)

1. `/admin/hierarchy` (team-adjacent route still on legacy shell).
2. CRM detail routes (`/crm/clients/:crmClientId`, `/crm/leads`).
3. Docket list/detail routes to fully remove legacy shell transitions around core docket operations.
4. Profile and compliance calendar routes to close remaining shell drift in daily navigation loops.

## Async feedback and state unification pass (April 2026)

### Root inconsistencies found

| Severity | Area | Issue | Impact |
| --- | --- | --- | --- |
| High | Queue/list modules | Table errors rendered as plain text without embedded retry actions. | Operators had to discover refresh manually and pages felt broken under transient failures. |
| High | Filterable pages | Empty dataset and filtered no-result states used identical wording. | Users interpreted no-results as loading bugs instead of active filter outcomes. |
| Medium | Background refresh | Some pages blocked full table reload for refresh while others were non-blocking. | Jarring reload behavior and inconsistent trust in list stability. |
| Medium | Mutation feedback | Key actions (QC, pull, save settings) depended on toast-only success/failure messaging. | Action outcomes were easy to miss and retry confidence was low. |
| Medium | Settings detail pages | Load failures surfaced toast-only with no in-page recovery. | Settings pages could strand users without explicit recovery controls. |

### Unified async rules adopted

1. **Recoverable table errors** must include a local retry control (`Retry`).
2. **Empty-state language split**:
   - no data baseline (`emptyLabel`) for first-use/true empty
   - filtered no-results (`emptyLabelFiltered`) when search/filter is active.
3. **Background refresh pattern**:
   - keep current data visible
   - show a subtle inline “Refreshing…” notice
   - avoid blank table reset for non-initial refreshes.
4. **Mutation feedback pattern**:
   - button-level in-flight labels (`Updating…`, `Pulling…`, `Saving…`)
   - local inline status banner/message for save success/failure where appropriate
   - toasts remain supplemental.
5. **Settings recovery pattern**:
   - explicit load-error panel with retry action
   - inline operational status guidance during save/test actions.

### Shared primitives/helpers introduced

- Extended platform `DataTable` with:
  - inline error retry action (`onRetry`, `retryLabel`)
  - filtered empty state messaging (`hasActiveFilters`, `emptyLabelFiltered`).
- Added `RefreshNotice` helper in `PlatformShared` for non-blocking refresh visibility.
- Added a table feedback stack style for action-oriented recoverable error messaging.

### Pages/modules updated in this pass

- Clients-adjacent platform workspace pages:
  - `My Worklist`, `Workbaskets`, `QC Queue`, `CRM`, `CMS Intake`, `Reports`.
- Settings detail pages:
  - `AI settings`, `Storage settings`, `Work settings`.

### Tests added/updated

- Added `tests/uiAsyncStateConsistency.test.js` to assert:
  - retry affordance support in shared platform table
  - refresh notice + retry usage across queue/list module pages
  - inline retry and mutation feedback patterns on key settings pages.

### Follow-up items still pending

1. Extend the same async-state contract to legacy-heavy pages (`AdminPage`, `CasesPage`, client detail mutation subflows) with component-level refactors.
2. Add browser-level test coverage for visual loading/refresh transitions and retry click paths.
3. Consolidate permission-limited and configuration-incomplete empty-state wrappers for non-platform pages.

### Manual QA checklist — async consistency pass

- [ ] Load dashboard on a cold session and verify shell remains stable while module pages initialize.
- [ ] Open Clients, QC queue, Worklist, Workbaskets, Reports, and Settings pages.
- [ ] Verify each page shows intentional loading state copy (not raw placeholders).
- [ ] Verify first-use empty states differ from filtered no-results copy.
- [ ] Trigger simulated fetch failures (dev tools/offline or API mock) and confirm retry controls are visible.
- [ ] Validate queue actions (QC, pull, resolve/pend) show in-flight button state and clear success/error feedback.
- [ ] Validate settings saves/tests (AI, Storage, Work settings) show inline status and clear failure guidance.
- [ ] Confirm background refresh keeps prior data visible and does not reset page framing.
- [ ] Confirm no raw broken error strips remain on hardened pages.
- [ ] Confirm async wording is consistent (“Refresh”, “Retry”, “Updating…”, “Saving…”).

## Core docket workflow unification pass (April 2026)

### Routes audited

- `/app/firm/:firmSlug/dockets`
- `/app/firm/:firmSlug/dockets/:caseId`
- `/app/firm/:firmSlug/worklist`
- `/app/firm/:firmSlug/global-worklist`
- `/app/firm/:firmSlug/qc-queue`
- `/app/firm/:firmSlug/clients/:clientId`
- `/app/firm/:firmSlug/admin/hierarchy`
- `/app/firm/:firmSlug/profile`
- `/app/firm/:firmSlug/compliance-calendar`
- `/app/firm/:firmSlug/crm/leads`
- `/app/firm/:firmSlug/crm/clients/:crmClientId`

### Root workflow inconsistencies found

1. Dockets list/detail still used `Layout`, while adjacent queue pages used `PlatformShell`, causing shell jumps.
2. Docket detail had no explicit queue/list return affordance, creating context loss after drill-in.
3. Worklist/workbasket/QC queue detail links did not preserve return path context.
4. Profile/Hierarchy/Compliance/CRM Leads/CRM Client Detail remained on legacy shell framing.
5. `PlatformShell` account pill lacked visible logout affordance, unlike legacy `Layout`.

### Docket-flow issues fixed

- Migrated dockets list and docket detail wrappers to `PlatformShell` with consistent module/title/subtitle composition.
- Added explicit “Back to queue” action in docket detail with safe return-path resolution:
  - prefer navigation state `returnTo`
  - fallback to query `returnTo`
  - final fallback to canonical dockets list.
- Added `returnTo` context when opening docket detail from:
  - dockets list
  - my worklist
  - global workbaskets
  - QC queue.
- Preserved previous/next navigation behavior in detail using existing source-list state.

### Remaining legacy route migration pass

Migrated to `PlatformShell` in this pass:

- `/admin/hierarchy`
- `/profile`
- `/compliance-calendar`
- `/crm/leads`
- `/crm/clients/:crmClientId`

### Shell/page rules applied

- Unified shell: all routes above now use `PlatformShell` (no legacy `Layout` wrapper).
- Standardized page identity via `moduleLabel`, `title`, and `subtitle`.
- Preserved existing permission and business logic behavior; migration focused on shell/frame continuity.
- Browser title remains managed through shell-level title contract.

### Logout discoverability fix

- Added an explicit account menu in `PlatformShell` top-right with visible chevron affordance.
- Added keyboard-accessible menu semantics (`aria-haspopup="menu"`, `aria-expanded`, Escape/blur close behavior).
- Added explicit **Sign out** action that calls AuthContext logout, preserves firm slug for routing hint, and redirects to firm login with success messaging state.

### Follow-up items

- Docket-detail inner section composition is still dense and should be progressively split into dedicated sub-sections in a future refactor pass.
- Add end-to-end browser assertions for post-logout back-button protection once E2E harness is in place.
