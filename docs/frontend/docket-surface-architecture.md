# Docket Surface Architecture

## Scope
Core docket reliability surfaces:
- All Dockets: `ui/src/pages/CasesPage.jsx`
- Docket detail: `ui/src/pages/CaseDetailPage.jsx`

## Page/component breakdown
### All Dockets
- **Orchestration:** query-state sync, filters, sort, search, bulk selection (`CasesPage`).
- **Sections:** header/actions, SLA summary, filters, saved views, performance panel, registry table.
- **Table behavior:** column config isolated in `ui/src/components/cases/useCasesTableColumns.jsx`.
- **Overlays:** timeline drawer, bulk upload modal, confirm modal.

### Docket detail
- **Orchestration:** data load, section state, permissions, lifecycle actions (`CaseDetailPage`).
- **Workflow modal surface:** extracted to `ui/src/pages/caseDetail/CaseWorkflowModals.jsx`.
- **Queue continuity controls:** back/prev/next driven by shared hook.

## Hooks and utilities introduced
- `ui/src/hooks/useDocketQueueNavigation.js`
  - Resolves safe `returnTo`.
  - Preserves `{ sourceList, index, returnTo }` for prev/next navigation.
- `ui/src/utils/docketSla.js`
  - `isDocketSlaBreached`
  - `isDocketDueToday`
  - `getDocketSlaBadgeStatus`
  - `getDocketRecencyLabel`

## Action handling rules
1. Use per-action in-flight state (`resolvingCase`, `qcSubmitting`, `routeSubmitting`, etc.).
2. Guard duplicate submits early (`if (submitting) return`).
3. Show predictable success/error feedback for each action path.
4. Refresh docket data with targeted background reload after successful transitions.

## Queue return-context rules
1. Prefer `location.state.returnTo` when it is a valid firm app route.
2. Fallback to query `returnTo` only when valid.
3. Final fallback: `ROUTES.CASES(firmSlug)`.
4. Prev/next navigation must preserve queue context state.

## Loading/error state rules
1. Keep existing safe data visible during background refresh.
2. Scope transient failures to section/action where possible.
3. Use full-page error fallback only for unrecoverable page-load failures.
4. Keep empty states explicit and actionable.

## Biggest remaining docket-surface risks
1. `CaseDetailPage.jsx` is still large and mixes orchestration with section rendering.
2. Some workflow action handlers remain inline and tightly coupled to page state.
3. Queue-origin behavior is still distributed across list pages and can drift without shared tests.
4. Current tests are mostly structure/string assertions; behavioral integration coverage is still thin.
