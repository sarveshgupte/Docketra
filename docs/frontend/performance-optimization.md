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
