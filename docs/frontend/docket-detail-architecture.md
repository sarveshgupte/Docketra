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
  - Accessibility contract: renders as a keyboard-dismissible dialog (`role="dialog"` + `aria-modal`), moves focus into panel on open, restores focus on close, and supports Escape/backdrop/close-button exit.
  - Status announcements: CFS loading/error/empty states and upload-link copy feedback use polite live regions for assistive technologies.
  - Upload-link PIN handling: hidden PIN state is visually masked and not announced by screen readers until explicitly revealed.

## Hooks and data boundaries

### Existing orchestration query
- **`useCaseQuery`** remains the canonical docket query source.

### Workflow action hooks
- **`useDocketLifecycleActions.js`**
  - Owns lifecycle transitions and route/submit/file actions (`pend`, `unpend`, `resolve`, `file`, `route`, `submit routed`).
  - Preserves confirmation copy, optimistic resolve update behavior, and existing offline queue integration.
- **`useDocketAttachments.js`**
  - Owns attachment upload flow and generated upload-link flow.
  - Preserves optimistic attachment insertion and existing toast/error copy.
- **`useDocketClone.js`**
  - Owns clone modal category/subcategory state, clone catalog loading, and clone action execution/navigation.
- **`useDocketRetryQueue.js`**
  - Owns offline queued action persistence/retry/backoff lifecycle.

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
- `ui/tests/cfsInfoButtonFlow.test.mjs` (CFS sidebar wiring + a11y semantics/copy announcements)

## Route/Submit action visibility contract

- Route is available only in docket detail and requires target PRIMARY active workbasket + compulsory comment.
- When docket is routed to a non-owner receiving team user, action bar shows **Submit** instead of **Resolve**.
- Submit helper text must state it returns docket to original routing user and does not finally resolve docket.
- Receiving routed-team users must not see **File** action for routed dockets.
- Owner/originator receives returned docket back into personal worklist context.

## UX contract (polished layout)

- Summary metadata is owned by `CaseDetailSummaryHeader.jsx`; the Overview panel must avoid duplicating core docket metadata (category/subcategory, owner/workbasket/timestamps) already shown in the header.
- Docket actions appear near the top of the Details card and are grouped by visual hierarchy:
  - **Primary:** Resolve or Submit (state/policy-driven, never both).
  - **Secondary:** Pend, Route, File (with existing policy gates unchanged).
  - **Admin / advanced:** Assign, Move to Workbasket, Force QC.
- Existing lifecycle and permission gates remain source-of-truth in route orchestration and policy helpers; this contract is presentation-only.
- Overview client related-dockets presentation is a compact **Recent dockets** card:
  - limited preview rows (currently 3),
  - shortcut CTA **View all in History**,
  - no duplication of full History tab table in Overview.
- Empty state copy requirements:
  - No related dockets.
  - Missing description.
  - Internal work docket context.
  - Terminal docket guidance (record-view only).


## History Tab Behavior (Client Docket History)

- **Change History** shows audit/timeline events for the **current docket** only.
- **Client Docket History** shows **other dockets for the same client** in newest-first order.
- The current docket is explicitly excluded from Client Docket History.
- Client docket history is tenant-scoped: backend query filters by both `firmId` and `clientId`.
- Client Docket History table includes: Docket ID, Category, Subcategory, Status/Lifecycle, Created Date, Updated Date, Closed/Resolved/Filed Date, Assigned To/Owner, Workbasket/Queue, and a View action.
