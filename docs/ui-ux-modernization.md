# Docketra UI/UX Modernization Plan (Phase 1)

## Audit summary (April 25, 2026)

This audit focused on production routes and shared UI primitives powering firm workspaces, CRM/CMS surfaces, dockets/worklists, and admin/superadmin pages.

### High-level themes

1. **Design drift across generations of UI**
   - The codebase currently contains at least three visible styling systems: platform-shell CSS primitives (`platform.css`), Tailwind utility-heavy pages, and older "neo" classes.
   - Result: inconsistent spacing rhythm, typography hierarchy, and control sizing across modules.

2. **App shell consistency is improving but not yet fully standardized**
   - `PlatformShell` gives strong structure, but not all pages/components consistently follow shared section header patterns and control alignment.

3. **Tables/forms/feedback states are partially standardized**
   - Strong reusable building blocks exist (`Button`, `Input`, `DataTable`, `EmptyState`, notices), but some module-level pages still render bespoke states and mixed copy.

4. **Accessibility baseline exists but has gaps**
   - Skip links and focus styles are present in key areas, but some focus styling and interaction transitions are scoped too broadly or inconsistently.

---

## Detailed findings

| # | Issue title | Affected files / routes / components | Why it hurts UX | Severity | Recommended fix | When |
|---|---|---|---|---|---|---|
| 1 | Mixed heading systems inside admin sections | `ui/src/pages/admin/components/AdminUsersSection.jsx`, `AdminClientsSection.jsx`, `AdminCategoriesSection.jsx`, `ui/src/pages/AdminPage.css` | Users see inconsistent section hierarchy and visual rhythm inside one mission-critical surface (admin operations). | Medium | Standardize section header title + description styles and copy in all admin tabs. | **Now (safe)** |
| 2 | Platform interaction styles scoped too broadly | `ui/src/components/platform/platform.css` | Global selector patterns can leak transition/focus behavior and create unpredictable control behavior outside platform shell. | Medium | Scope control transitions to `.platform` descendants only. | **Now (safe)** |
| 3 | Mixed dashboard paradigms (legacy + platform) | `ui/src/pages/Dashboard.jsx` vs `ui/src/pages/platform/DashboardPage.jsx` | Different patterns create inconsistent mental models and QA complexity; feature parity can drift. | High | Keep both stable for now; converge page container/header/components in later migration PR. | Later |
| 4 | Multiple table implementations with different affordances | `ui/src/pages/platform/PlatformShared.jsx` (`DataTable`) vs `ui/src/components/common/DataTable.jsx` | Sorting/pagination/empty/error behavior differs by module; users relearn interaction each page. | High | Define a table standard contract and incrementally consolidate onto one reusable table foundation. | Later |
| 5 | Inconsistent empty/loading/error microcopy | Platform pages + legacy pages (`CasesPage`, `Dashboard`, CRM/CMS pages) | Perceived polish drops when state language is not uniform or actionable. | Medium | Introduce central UX copy map for async states and retrofit module-by-module. | Later |
| 6 | Spacing/token inconsistency | `theme/tokens.js`, `platform.css`, legacy page CSS files | Inconsistent density impacts scan speed and perceived trust for enterprise users. | Medium | Establish one spacing scale for shell/page/section/content controls and enforce in shared components. | Later |
| 7 | Button variant contract mismatch in some pages | Example: category actions in admin components use variants beyond strict shared map | Risks visual inconsistency and unpredictable fallback variant behavior. | Medium | Normalize variant usage and enforce with lightweight lint/test guardrails. | Later |
| 8 | Responsive behavior is functional but uneven at edge widths | `platform.css` media queries + legacy page layouts | Controls can crowd/wrap inconsistently, especially in action-heavy headers/tables. | Low-Medium | Continue progressive responsive hardening per module, starting with dense queue pages. | Later |
| 9 | Accessibility quality varies by surface | Platform shell has skip link/focus, but legacy screens vary | Keyboard confidence depends on route; inconsistent focus treatment harms power users. | Medium | Define and apply shared a11y checklist for headers, tables, filter bars, and modals. | Later |
| 10 | Visual language includes legacy decorative remnants | `assets/styles/neomorphic.css`, mixed old card/header classes | Reduces premium SaaS consistency and increases maintenance burden. | Low-Medium | Decommission legacy style layer after incremental component migration. | Later |

---

## Chosen design principles for Docketra (B2B-first)

1. **Operational clarity over ornament** (information hierarchy first).
2. **Consistent interaction contracts** (same actions should look/behave the same).
3. **Predictable density** (fast scanning for daily heavy users).
4. **Composable shared primitives** (buttons/inputs/tables/states reused, not recreated).
5. **Accessibility as default behavior** (focus, keyboard, state feedback, contrast).
6. **Incremental modernization** (small safe PRs that do not touch business logic).

---

## First PR scope (this PR)

### Why this PR first
It is narrow, low-risk, and high-signal:
- touches **presentation only**,
- improves consistency in a high-value operational surface (admin),
- reduces CSS leakage risk in platform shell,
- does not alter routing, RBAC, auth, tenant behavior, or backend logic.

### What changed

1. **Admin section headers standardized**
   - Unified title + supporting description pattern across Users, Clients, and Categories tabs.
   - Added shared admin section title/description styles to reduce drift.

2. **Platform style scoping tightened**
   - Transition styling now scoped to `.platform` descendants.
   - Added explicit focus-visible style for platform navigation links.
   - Minor action-row text wrapping normalization for shell topbar actions.

### Files/components changed

- `ui/src/pages/admin/components/AdminUsersSection.jsx`
- `ui/src/pages/admin/components/AdminClientsSection.jsx`
- `ui/src/pages/admin/components/AdminCategoriesSection.jsx`
- `ui/src/pages/AdminPage.css`
- `ui/src/components/platform/platform.css`
- `docs/ui-ux-modernization.md`

---

## What improved in this PR

- Cleaner and consistent admin information hierarchy.
- Better visual continuity across admin tabs.
- Safer platform CSS behavior due to tighter selector scoping.
- Improved keyboard discoverability on platform nav links.

---

## Remaining UI/UX gaps (post-PR)

1. Standardize table implementations and interaction model across all modules.
2. Introduce unified page header/container pattern across legacy + platform pages.
3. Normalize async state copy and patterns (empty/loading/error).
4. Continue responsive hardening for dense queue/list interfaces.
5. Retire legacy style layer (`neomorphic`) after migration.

---

## Recommended next PRs

1. **PR 2: Shared Page Header + Container contract**
   - Apply consistent title/subtitle/actions spacing pattern to legacy pages.
2. **PR 3: Table consistency pass**
   - Align headers, row density, empty/error/loading states, pagination language.
3. **PR 4: Form/filter consistency pass**
   - Inputs/selects/filter bars to one tokenized contract.
4. **PR 5: State UX polish**
   - Strong empty states, skeleton usage rules, and actionable retry/error patterns.



## Expansion implemented after review (same first modernization slice)

This PR was expanded (still presentation-only and low-risk) to cover more of the admin-facing surface:

1. **Admin section header contract componentized**
   - Added `AdminSectionHeader` and applied it across Users, Clients, and Categories sections for consistent title/description/actions structure.
2. **Shared admin status badge contract**
   - Added `AdminStatusBadge` and reused it across admin tables for consistent status tone mapping.
3. **Admin page header/toolbar contract tightened**
   - Unified page-level header actions (primary + refresh), tab area semantics, and standardized inline status messaging stack.
4. **Admin modal cleanup (safe neo reduction)**
   - Replaced legacy `neo-*` read-only/info/action classes in admin modals where safe with scoped `admin__*` classes.
5. **Table/action alignment polish**
   - Right-aligned action columns and action groups in admin tables for better scan consistency.
6. **Responsive + accessibility polish on admin surface**
   - Added scoped focus-visible treatment in admin surface and responsive wrapping behavior for header/section action groups.

### Exact admin surfaces touched in expansion
- `AdminPage` shell-level header + toolbar + status stack
- Users section
- Clients section
- Categories section
- Client modals
- Category modals
- Bulk paste modal

### Remaining gaps after this expansion
1. Admin list filtering/search density could be improved with shared filter-row primitives.
2. Modal internals still include some inline style blocks that should be tokenized in a follow-up PR.
3. Cross-module page header/container contract is still not fully applied outside admin.

### Recommended next PR (still low-risk)
**PR 2: Page container + header consistency pass for non-admin platform modules**
- apply the same header/toolbar/status contract to Worklist/Workbench/QC/CRM/CMS pages,
- standardize section spacing and async state presentation,
- keep logic untouched.



### Post-review corrections (final polish)
- Removed duplicate primary CTAs from the admin page header (section headers remain the single source for create/bulk actions).
- Corrected admin tab control semantics for this low-risk pass by treating controls as standard navigation buttons (removed mixed tablist/aria-pressed pattern).

---

## Second PR scope (non-admin platform module contract pass)

### Scope completed in this PR
- Applied a consistent **status-message stack** pattern across non-admin platform pages so info/error/success messages appear in one predictable location.
- Standardized **section toolbar placement** on queue-driven pages (Worklist, Workbench, QC Workbench, CMS intake queue): filters/search stay in toolbar, refresh actions are consistently placed in section header actions.
- Tightened **spacing and responsive wrapping** in platform content/sections/toolbars for denser but clearer operational scans.
- Improved **focus-visible affordances** for page/section actions, module tiles, filter controls, and table actions.
- Removed decorative progress gradient in the platform productivity bar to align with the production-focused visual direction.

### Exact pages/components touched
- `ui/src/pages/platform/PlatformShared.jsx`
- `ui/src/pages/platform/WorklistPage.jsx`
- `ui/src/pages/platform/WorkbasketsPage.jsx`
- `ui/src/pages/platform/QcQueuePage.jsx`
- `ui/src/pages/platform/DashboardPage.jsx`
- `ui/src/pages/platform/CrmPage.jsx`
- `ui/src/pages/platform/CmsPage.jsx`
- `ui/src/components/platform/platform.css`

### Before / after UX impact
- **Before:** Status messages and refresh feedback were rendered ad hoc (multiple inline notices, mixed placement); filter + refresh controls were inconsistently grouped; focus cues were available but uneven on high-traffic controls.
- **After:** Status messages now follow a single stacked contract; queue toolbars consistently separate filtering from section-level refresh actions; keyboard focus indicators are clearer and more consistent; spacing and wrapping are more reliable at tablet/laptop widths.

### Remaining UI/UX gaps
1. All Dockets (`CasesPage`) still uses its legacy section contract and should be aligned with this toolbar/status pattern in a dedicated low-risk pass.
2. Task Manager and Settings pages could adopt a stricter primary/secondary CTA hierarchy for parity with queue pages.
3. CMS form editor still relies on several inline layout styles that should be moved into shared scoped classes.

### Recommended next PR
**PR 3: All Dockets + legacy platform parity pass**
- Bring `CasesPage` and remaining non-admin legacy pages onto the same section toolbar + status stack contract.
- Normalize page-level header action hierarchy (single primary CTA, secondary in section context only).
- Continue responsive hardening around dense table/action layouts without altering business logic or data contracts.

---

## Third PR scope (All Dockets + remaining legacy docket list parity)

### Scope completed in this PR
- Aligned **All Dockets (`CasesPage`)** to the platform section contract by using a unified `PageSection` + `SectionToolbar` structure for list controls and section actions.
- Added a **`StatusMessageStack`** on `CasesPage` so error/refresh messages now render in one consistent stack, matching Worklist/Workbench/QC/CRM/CMS/Dashboard behavior.
- Consolidated All Dockets controls (search, saved views, view chips, filters, bulk actions) inside the section toolbar for clearer scan order and cleaner responsive wrapping.
- Removed mixed tab semantics from All Dockets control chips and switched to safer button-group semantics (`aria-pressed`) to avoid incorrect ARIA tab patterns.
- Modernized the legacy **Filtered Dockets** list surface to the same page/section/status contract with platform shell/section/table patterns and consistent retry/error copy.

### Exact pages/components touched
- `ui/src/pages/CasesPage.jsx`
- `ui/src/components/cases/CasesPageSections.jsx`
- `ui/src/pages/CasesPage.css`
- `ui/src/pages/FilteredCasesPage.jsx`
- `docs/ui-ux-modernization.md`

### Before / after UX impact
- **Before:** All Dockets mixed page-header, standalone control blocks, and section cards with status/refresh feedback split between table-level messaging and ad hoc placements; legacy filtered docket list used older layout/card patterns.
- **After:** All Dockets now follows a single section-toolbar pattern with consistent status stack placement and clearer CTA hierarchy inside the registry section; filtered docket list now uses the same platform page/section/feedback contract for parity and faster scan.

### Remaining UI/UX gaps
1. `TaskManagerPage` and `SettingsPage` still have minor action hierarchy and toolbar placement differences vs queue-centric modules.
2. Some legacy route-level pages outside core docket workflows still use older card/header patterns and could be incrementally migrated.
3. Shared table primitives are still split between platform and app-level implementations (tracked for a later consolidation PR).

### Recommended next PR
**PR 4: Non-queue platform polish + shared table convergence prep**
- Normalize toolbar/action hierarchy in Task Manager and Settings.
- Continue migrating remaining low-risk legacy list/detail surfaces onto `PageSection` + `SectionToolbar` + `StatusMessageStack`.
- Prepare a contract doc for future convergence between `PlatformShared` `DataTable` and app-level `DataTable` (no functional merge yet).

---

## Fourth PR scope (non-queue platform polish + table/list convergence prep)

### Scope completed in this PR
- Polished `TaskManagerPage` status and CTA hierarchy by consolidating async notices into a single `StatusMessageStack` and removing duplicate primary action exposure.
- Polished `SettingsPage` hierarchy and action placement with explicit settings module labeling and tighter admin/audit action grouping.
- Applied the same status stack contract on `ReportsPage` to remove remaining ad hoc notice placement in a non-queue platform route.
- Added a dedicated table/list convergence audit + migration plan document (`docs/ui-table-list-convergence.md`) without changing any table implementation behavior.

### Exact pages/components touched
- `ui/src/pages/platform/TaskManagerPage.jsx`
- `ui/src/pages/platform/SettingsPage.jsx`
- `ui/src/pages/platform/ReportsPage.jsx`
- `docs/ui-table-list-convergence.md`
- `docs/ui-ux-modernization.md`

### Before / after UX impact
- **Before:** Task Manager and Reports used mixed notice placement (`InlineNotice` + separate refresh notice); Task Manager exposed a duplicated primary CTA; settings hub had slightly weaker hierarchy alignment vs other platform modules.
- **After:** Non-queue platform pages now follow the same status-message stack contract, Task Manager CTA hierarchy is clearer (single primary in page header, secondary routing actions in section), and Settings action grouping is more predictable/scannable.

### Remaining UI/UX gaps
1. Legacy settings detail screens (`FirmSettingsPage`, `WorkSettingsPage`, `StorageSettingsPage`, `AiSettingsPage`) still mix older card/header patterns and could be normalized incrementally.
2. Platform and app/common table primitives remain split; migration should proceed via adapters to avoid queue and All Dockets regressions.
3. CMS form editor still includes several inline layout styles that should be tokenized in a low-risk follow-up pass.

### Recommended next PR
**PR 5: Settings detail surface consistency pass**
- Normalize section headers, action rows, and status stack placement across firm/work/storage/AI settings pages.
- Keep save/cancel/danger hierarchy consistent and role-safe.
- Do not alter settings API payloads or behavior.

### Post-review corrections (PR 3 follow-up)

#### Corrections made
1. **CasesPage layout consistency tightened (low-risk):**
   - Removed mixed usage of platform section wrappers in `CasesPage` and kept the page on its established app-level layout (`PageHeader` + `SectionCard` + app `DataTable`) to avoid half-platform/half-legacy visual drift.
   - Retained `StatusMessageStack` only for non-duplicative page-level refresh messaging.
2. **Duplicate error messaging removed:**
   - `CasesPage` no longer surfaces the same error in both status stack and table-level messaging; table-level error/retry remains the single error location.
3. **Refresh affordance restored:**
   - Re-enabled `DataTable` background refresh notice (`refreshing` + `refreshingMessage`) so users keep existing table-context feedback.
4. **Filter clear CTA behavior corrected:**
   - `Clear filters` is now disabled when filters are already at default (`status=ALL`, `workType=ALL`, no QC workbasket override).
5. **FilteredCasesPage risk reduction:**
   - Reverted the broader shell/table migration to keep this route close to prior behavior and avoid regression risk in access/loading/retry/pagination expectations for this pass.

#### Deferred product decision (intentional)
- **All Dockets work-type filter (`Client Work` / `Internal Work`)** remains in place for now to avoid changing established admin registry behavior in a UI-only pass.
- This should be confirmed with Product in a follow-up decision: retain as an explicit operational filter, relabel for clarity, or replace with a different client-selection paradigm.

#### Risk notes
- **CasesPage risk:** Low. Changes are presentation-only and preserve existing data queries, actions, routes, and retry behavior; layout stays on existing app primitives.
- **FilteredCasesPage risk:** Very low after scope reduction; route remains on prior structure with no contract migration in this correction pass.
