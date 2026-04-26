# UI Table/List Convergence Audit (April 26, 2026)

## Objective
Document the current table/list landscape, identify contract differences, and define a staged migration plan toward one shared table/list system **without changing table behavior in this PR**.

## Current implementations

## 1) Platform module table (`PlatformShared`)
- Primitive: `DataTable` in `ui/src/pages/platform/PlatformShared.jsx`.
- Primarily used by platform module routes (`/platform/*`) including Worklist, Workbench, QC Queue, CRM, CMS, and Reports.
- Current behavior:
  - Accepts `columns` as plain header labels and `rows` as rendered `<tr>` nodes.
  - Handles loading/error/empty/filtered-empty states.
  - Provides built-in page-size pagination (client-side).
  - Provides optional retry button.
  - No built-in sort contract.
  - No active-filter chip system.

## 2) App/common table (`components/common/DataTable`)
- Primitive: `DataTable` in `ui/src/components/common/DataTable.jsx` built on `Table` primitives.
- Used by app/common pages like All Dockets, legacy Workbasket, Clients, Dashboard, CRM pages, and Admin sections.
- Current behavior:
  - Accepts structured `columns` metadata with sortable headers.
  - Accepts raw `data` or `rows`, supports `rowKey` and cell renderers.
  - Supports active filter chips/removal/reset hooks.
  - Supports dense mode, refresh notice, row click keyboard behavior, and customizable pagination contract.
  - Uses external pagination state and callback model.

## 3) Additional list/table patterns
- Admin uses app/common `DataTable` but wraps it in module-specific controls (`AdminUsersSection`, `AdminClientsSection`, `AdminCategoriesSection`).
- Some pages still render bespoke lists/cards outside either table primitive (e.g., settings panels), which is acceptable for non-tabular workflows.

## Where each primitive is used today

### Platform `DataTable` usage
- `ui/src/pages/platform/WorklistPage.jsx`
- `ui/src/pages/platform/WorkbasketsPage.jsx`
- `ui/src/pages/platform/QcQueuePage.jsx`
- `ui/src/pages/platform/CrmPage.jsx`
- `ui/src/pages/platform/CmsPage.jsx`
- `ui/src/pages/platform/ReportsPage.jsx`

### App/common `DataTable` usage
- `ui/src/pages/CasesPage.jsx` (All Dockets)
- `ui/src/pages/WorkbasketPage.jsx`
- `ui/src/pages/ClientsPage.jsx`
- `ui/src/pages/DashboardPage.jsx`
- `ui/src/pages/crm/CrmClientsPage.jsx`
- `ui/src/pages/crm/LeadsPage.jsx`
- `ui/src/pages/crm/CrmClientDetailPage.jsx`
- `ui/src/pages/admin/components/AdminUsersSection.jsx`
- `ui/src/pages/admin/components/AdminClientsSection.jsx`
- `ui/src/pages/admin/components/AdminCategoriesSection.jsx`

## Contract differences that block immediate convergence

1. **Column/row API mismatch**
- Platform table expects pre-rendered `<tr>` rows and string headers.
- App/common table expects column objects and row data.

2. **Sorting**
- App/common has sortable header contract (`sortState`, `onSortChange`).
- Platform table has no sorting API.

3. **Pagination ownership**
- Platform: internal client-side paging by page size.
- App/common: externally-controlled pagination object and callbacks.

4. **Filter UX model**
- App/common includes active filter chips and clear behaviors.
- Platform handles filters outside table (via `FilterBar` and page-level state).

5. **Accessibility surface area**
- App/common supports row keyboard interaction and `aria-sort`.
- Platform table is simpler and does not yet expose row interaction semantics directly.

6. **Density and visual tokens**
- App/common has explicit dense mode and Tailwind token usage.
- Platform table uses platform CSS tokens and fixed compact sizing.

## CasesPage-specific behavior to preserve
- Sort model, saved-view interactions, active filters, refresh messaging, and table-level retry/empty behavior must remain stable during migration.
- Any convergence work should wrap/bridge existing behavior rather than rewriting All Dockets interactions first.

## Admin table considerations
- Admin sections rely on app/common table sorting + action-column patterns.
- Convergence should not regress admin role-management productivity (action grouping, status badges, and inline row actions).

## Recommended future shared contract (target)
A future shared table/list system should support:
- Column metadata (`key`, `label`, `sortable`, width/alignment).
- Data-driven rows plus optional custom row renderer.
- Loading, empty, filtered-empty, error, retry.
- Optional refreshing notice.
- Optional active-filter chips + clear/remove handlers.
- Optional dense mode.
- Optional row click + keyboard semantics.
- Optional controlled pagination and optional internal pagination adapter.
- Stable hooks for row actions and accessibility labels.

## Risks of immediate convergence
- Regressing queue-table behavior in high-traffic operational routes.
- Breaking CasesPage sort/filter/saved-view expectations.
- Introducing visual mismatch across platform CSS and app-level Tailwind contracts in one step.
- Enlarging PR blast radius across role-sensitive admin workflows.

## Staged migration plan

### Stage 0 (this PR)
- Audit + documentation only.
- No table behavior changes.

### Stage 1
- Build a thin compatibility adapter that allows platform pages to pass data/column objects while still rendering current platform visuals.
- Keep platform pagination semantics unchanged.

### Stage 2
- Introduce shared state contract for loading/error/empty/retry/refresh/active-filters across both implementations.
- Keep sort behavior opt-in by page.

### Stage 3
- Migrate one low-risk platform list page first (candidate: Reports metrics table).
- Validate keyboard/focus, responsive wrapping, retry and empty states.

### Stage 4
- Migrate queue pages (Workbench, Worklist, QC) with explicit regression checklist.
- Preserve existing filter toolbars and row action behavior.

### Stage 5
- Migrate All Dockets + Admin after explicit parity matrix sign-off.
- Remove redundant table implementation only after all routes are stable.

## Recommended next PRs
1. Add a typed/shared table contract doc + adapter scaffold in code (no route migrations yet).
2. Migrate Reports table to adapter-backed shared contract.
3. Add a11y regression checklist for sortable headers, row focus, pagination, and filter chips.
4. Queue-page migration PR with route-by-route parity tests.
