> **Historical document (point-in-time):** This file captures an earlier audit/readiness snapshot and may not reflect the current product surface. For current state, see `README.md`, `docs/product/current-product-overview.md`, and `docs/operations/pilot-readiness-checklist.md`.

# Docketra UI/UX Audit + Platform Frontend Improvements (April 2026)

## Audit scope
- Reviewed firm-scoped platform frontend surfaces in `ui/src/components/platform/` and `ui/src/pages/platform/`.
- Focused on daily operational workflows: dashboard, worklist, workbaskets, QC queue, reports, CRM, CMS intake, and settings.

## Key findings
1. **Navigation and shell consistency gaps**
   - Sidebar sections and topbar actions were present but lacked clear enterprise framing and predictable action hierarchy.
2. **Weak table/list ergonomics**
   - Core list pages lacked search/filter controls, robust empty/error/loading behavior, and consistent action labels.
3. **Inconsistent terminology and trust signals**
   - Visible UI mixed `case` and `docket` language in labels and messages, reducing product coherence.
4. **Dashboard/readability issues**
   - Dashboard and reports had partial placeholders without enough operational context and shortcut pathways.
5. **Settings discoverability**
   - Settings shell had cards but weak route-level affordances to key admin tasks.

## Design principles reinforced
- **Productivity-first hierarchy**: page title, purpose, then immediate actions.
- **Dense but scannable data**: clear filters, compact tables, and explicit empty/error states.
- **Stable operational language**: standardize visible “Docket” terminology.
- **Enterprise trust tone**: restrained visual system, minimal decorative treatment.

## Implemented standards
- Introduced shared platform UI primitives in `PlatformShared.jsx`:
  - `PageSection`, `FilterBar`, `StatGrid`, `InlineNotice`, and enhanced `DataTable`.
- Updated `PlatformShell` and `platform.css` to standardize:
  - Sidebar/nav grouping, sticky topbar, skip-link, button density, and section spacing.
- Added query/filter and refresh controls on high-frequency queue pages.
- Added loading/error/empty states for all platform tables and summary loads.
- Removed risky placeholder action from CRM (`createClient` dummy call) in favor of navigational workflow.

## Pages updated
- Dashboard (`platform/DashboardPage.jsx`)
- My Worklist (`platform/WorklistPage.jsx`)
- Workbaskets (`platform/WorkbasketsPage.jsx`)
- QC Queue (`platform/QcQueuePage.jsx`)
- Reports (`platform/ReportsPage.jsx`)
- CRM (`platform/CrmPage.jsx`)
- CMS Intake (`platform/CmsPage.jsx`)
- Settings (`platform/SettingsPage.jsx`)

## Why these changes matter
- Reduces navigation and action ambiguity for admin, manager, and user roles.
- Speeds routine execution with table-level filtering and predictable action placement.
- Improves resilience perception with explicit loading and failure messaging.
- Increases enterprise readiness through consistent structure and terminology.

## Recommended next steps
1. Add server-side pagination and sort controls to platform tables.
2. Add optimistic row-level action feedback (success/error toasts).
3. Consolidate non-platform legacy pages onto the same shared shell primitives.
4. Add keyboard shortcut hints in headers for high-frequency actions.

## Refinement pass (pre-merge)

### 1) Topbar action ownership
- Removed hardcoded shell actions and made each page provide context-aware `actions` through `PlatformShell`.

### 2) DataTable pagination
- Added lightweight client-side pagination in `DataTable` with page state and Previous/Next controls.
- Pagination is opt-in by data length and does not change existing API contracts.

### 3) Table action consistency
- Standardized first action as primary context entry (first-column link pattern).
- Grouped secondary actions and added distinct destructive styling for risky actions.

### 4) Success feedback
- Added inline success notices for mutation-driven flows (Worklist, Workbaskets, QC Queue).

### 5) FilterBar UX
- Added built-in "Clear filters" support and grouped controls for consistent spacing.

### 6) Accessibility and states
- Added focus-visible styling for interactive controls.
- Added disabled handling for refresh/pagination/clear actions where relevant.

### 7) Performance safety
- Kept implementation lightweight with local state, memoized row slicing, and no new dependencies.
