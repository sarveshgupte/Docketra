# Frontend Performance Optimization Strategy

## Scope
This document covers targeted, low-risk performance improvements for main operator workflows (docket list/detail, clients, dashboard/module navigation).

## Cache and invalidation strategy
- Keep list caches warm while navigating to detail pages; avoid full list reloads unless list-affecting fields changed.
- Prefer narrow refreshes:
  - Docket detail mutations refresh detail panels and cached detail snapshots.
  - Client fact-sheet mutations refresh the selected client model and update local list rows instead of full list reload.
- Use stale-while-refreshing where possible (`keepPreviousData` / preserve old rows while background fetch runs).

## Navigation speed and continuity
- Docket detail is prefetched on row hover from the dockets list to reduce first-open latency.
- Route transitions are instrumented with lightweight timing logs (`[perf] Route transition`) to identify janky paths.
- Scroll restoration preserves list context on browser back/forward for list/detail workflows.

## Loading-state principles
- Keep page shells stable during background refresh.
- Avoid clearing table data during refetch; show inline refresh cues instead of white-screen transitions.
- Localize mutation busy indicators to action controls (e.g., saving/deleting/uploading states in modal/panel sections).

## API chatter controls
- Axios layer tracks duplicate in-flight request signatures in dev logs.
- Slow API responses are logged with route/method context when threshold is exceeded.

## Instrumentation added in this PR
- Route transition timing logs for route-to-route navigation.
- Slow API response logs and duplicate in-flight request warning logs.
- Existing command-center request instrumentation retained.

## Guardrails
- No business-logic changes.
- No broad frontend architecture rewrite.
- Favor correctness over aggressive optimistic assumptions.

## 2026-04-23 — Docket detail decomposition + deferred sections

### Bottlenecks identified
- `CaseDetailPage` eagerly rendered heavy secondary surfaces (attachments tooling, activity timeline, history tables) even when not visible.
- Timeline API calls ran on initial load regardless of active tab, increasing first-open network + CPU work.
- Client-related docket history fetched eagerly, even if users only needed core summary/actions.
- Background reload paths toggled section loading broadly, causing avoidable UI jank in unrelated sections.

### Changes shipped
- Extracted heavy secondary tabs into dedicated modules:
  - `CaseDetailAttachmentsPanel`
  - `CaseDetailActivityPanel`
  - `CaseDetailHistoryPanel`
- Added section skeleton fallback component (`CaseDetailPanelSkeleton`) and wrapped deferred tabs in `React.Suspense`.
- Deferred timeline fetch until Activity tab is active.
- Deferred client docket history fetch until Overview or History tab is active.
- Removed detail-surface debug logging and dead debug effects.

### Mutation/rerender scope improvements
- Kept optimistic/local panel state updates for comments and attachments.
- Preserved page shell/header/action controls while deferred chunks load.
- Avoided broad first-load-like section resets by limiting expensive fetches to active tab context.

### Manual QA steps
1. Open a docket from All Dockets and verify summary header/actions paint immediately.
2. Open Activity tab and confirm timeline data fetch occurs on-demand and pagination still works.
3. Add a comment and verify no full-page reset/flash.
4. Open Attachments tab and upload a file; verify list updates and no unrelated panel reset.
5. Open History tab and verify audit list + client docket history load correctly.
6. Use back button to return to originating queue/list context.

### Follow-up items
- Extract overview/header/action surfaces into dedicated memoized components for deeper isolation.
- Introduce section-level query hooks for comments/attachments/history to support more granular cache invalidation.
- Add automated UI integration tests for tab-level chunk loading and mutation isolation.
