# Docket Detail Architecture

## Scope

Primary route and surface:
- `ui/src/pages/CaseDetailPage.jsx`

This page remains the route-level orchestrator and delegates section rendering and focused logic to case-detail modules.

## Component boundaries

### Route orchestration
- **`CaseDetailPage.jsx`**
  - Owns route params, queue return context, lifecycle action handlers, modal state, and top-level page shell.
  - Coordinates case query hydration and optimistic updates.
  - Composes all detail modules listed below.

### Header and status summary
- **`CaseDetailSummaryHeader.jsx`**
  - Renders docket identity and high-level status snapshot.
  - Displays key summary fields (category/subcategory, client, assignee, workbasket, timestamps).

### Alerts and role-aware notices
- **`CaseDetailAlerts.jsx`**
  - Renders recoverable action errors and operational warning banners.
  - Centralizes role-restriction, lock, inactivity, and SLA risk/breach notices.

### Tabs and major sections
- **`StickyTabs` in `CaseDetailPage.jsx`** defines tab shell.
- **Overview tab:** `CaseDetailOverviewPanel.jsx`
- **Attachments tab:** `CaseDetailAttachmentsPanel.jsx` (lazy)
- **Activity tab:** `CaseDetailActivityPanel.jsx` (lazy)
- **History tab:** `CaseDetailHistoryPanel.jsx` (lazy)

### Workflow and action modals
- **`CaseWorkflowModals.jsx`**
  - Central modal surface for pend/resolve/unpend/file/route/assign/QC actions.

### Side surfaces
- **`DocketSidebar`**
  - Attachments helper, history quick context, and client fact-sheet panel.

## Hooks and data boundaries

### Existing orchestration query
- **`useCaseQuery`** remains the canonical docket query source.

### Extracted section-fetch hooks
- **`useCaseDetailTimeline.js`**
  - Owns activity timeline fetch and normalization.
  - Fetches only when Activity tab is active.
- **`useClientDocketHistory.js`**
  - Owns related client-dockets fetch.
  - Fetches only for Overview/History tabs.

### Explicit permission policy helpers
- **`caseDetailAccess.js`**
  - `canCloneDocketByPolicy`
  - `canRouteDocketByPolicy`
  - `canAdminMoveAssignedDocketForUser`
  - `isRoutedTeamCannotResolve`

These helpers keep role/permission behavior explicit and independently testable.

## Where to add future features

- **New tab-level section:** add a dedicated `ui/src/pages/caseDetail/CaseDetail*Panel.jsx` module and wire it in `CaseDetailPage.jsx`.
- **New tab-specific fetch path:** add a dedicated hook in `ui/src/pages/caseDetail/` and keep tab-activation gating inside the hook.
- **New role/permission rule:** add/extend helpers in `caseDetailAccess.js` and reference helper outputs from route orchestration.
- **New workflow action modal:** extend `CaseWorkflowModals.jsx` and keep API mutation handler in route orchestration unless shared by multiple pages.
- **New summary/header metadata:** extend `CaseDetailSummaryHeader.jsx` only; avoid duplicating summary fields in tab panels.

## Regression coverage

Current smoke/regression checks:
- `ui/tests/caseDetailPerformanceRefactor.test.mjs`
- `ui/tests/caseDetailArchitectureSmoke.test.mjs`
- `ui/tests/docketSurfaceHardening.test.mjs`

