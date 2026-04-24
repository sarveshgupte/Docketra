# Performance Baseline — April 2026

## Slow surfaces addressed in this PR
1. Dashboard
2. Docket Workbench (Task Manager)
3. Workbench
4. My Worklist
5. QC Workbench
6. Reports
7. Platform shell command-center search
8. Legacy shell notification loading

## What performance improvements were made
- Replaced repeated page-level fetch effects with shared React Query hooks for key platform surfaces.
- Introduced cache reuse and stale windows to prevent avoidable remount refetches.
- Preserved prior data during refresh (`keepPreviousData`) to reduce "wait then repaint everything" behavior.
- Shifted refresh UX to scoped background loading (`isFetching`) instead of broad blocking loaders.
- Added lightweight instrumentation (`trackAsync`) for slow requests and duplicate in-flight request visibility.
- Reduced command-center request churn with search-result caching and one-time client-directory loading.
- Reduced notification chatter by de-duping in-flight fetches and limiting poll/socket overlap.

## Which screens benefited most
- **Workbench / My Worklist / QC Workbench**: strongest perceived speed gains due to list-data reuse and background refresh.
- **Dashboard + Docket Workbench**: better revisit speed and fewer redundant summary loads.
- **Reports**: less blocking refresh behavior while preserving existing metric data.
- **Command-center**: faster repeated searches and lower backend chatter.
- **Legacy notifications**: fewer redundant notification fetch cycles.

## Which duplicate fetches were removed
- Duplicate dashboard summary fetches across Dashboard and Docket Workbench page mounts.
- Re-mount refetch loops for Workbench, My Worklist, QC Workbench, and Reports where data was already recently fetched.
- Repeated command-center client-list fetches during typing/search sessions.
- Notification polling requests overlapping with recent socket events and in-flight fetches.

## Which loading states were improved
- Replaced multiple full-surface blocking states with background refresh notices where stale data exists.
- Kept table/card content visible during manual refreshes and revisit fetches.
- Reduced flash-of-empty-content behavior on route revisit for core platform list/summary pages.

## Queue hardening addendum (April 23, 2026)

### Issues identified
- **My Worklist** was doing client-side search/filter/sort on every keystroke and every sort click, with full table recomputation.
- **My Worklist + Workbasket** showed heavier loading transitions than needed during parameter changes.
- **Row hover prefetch intent** existed in queue surfaces, but table row hover handlers were being dropped by the shared `TableRow` wrapper.
- **QC Workbench** had no detail prefetch for likely row-to-detail navigation.

### Frontend changes in this PR
- Moved non-pending **My Worklist** search/category/subcategory/sort to server query params and React Query cache keys.
- Added `keepPreviousData` behavior for **My Worklist** fetches so previous rows stay visible while refreshed data loads.
- Disabled overly aggressive focus-refetch for the queue query where cached data is still fresh.
- Added background “Refreshing …” messaging for **My Worklist** and **Workbasket** while preserving table body continuity.
- Fixed shared table row event passthrough so `onMouseEnter` reaches rows and queue prefetch hooks execute reliably.
- Added docket detail prefetch on likely navigation intent (pointer hover) for **My Worklist**, **Workbasket**, and **QC Workbench**.

### Backend changes in this PR
- Extended `GET /api/worklists/employee/me` to support:
  - `search`
  - `category`
  - `subcategory`
  - `sortBy`
  - `sortOrder`
- Kept existing pagination contract and tenant scoping intact while pushing high-churn list transforms to Mongo query execution.

### Known limitations / follow-up
- Full row virtualization was intentionally not introduced in this PR because current table semantics (sticky behaviors + action controls) need a focused pass to avoid UX regressions.
- `CasesPage` still has broad derived-data work that should be profiled and split in a follow-up optimization pass.

## Before/after observations (qualitative)
- **Before**: each mount of high-traffic pages triggered new API calls and full loading states.
- **After**: revisiting these pages reuses cached data and refreshes in background, reducing blank-state flashes.
- **Before**: command-center often retriggered broad fetch patterns while typing.
- **After**: repeated terms hit local cache and client data is reused.
- **Before**: notifications used fixed polling regardless of recent socket events.
- **After**: polling avoids tight overlap after socket updates and skips redundant in-flight fetches.

## Remaining hotspots (next PR)
- **All Dockets (`CasesPage`)**: heavy derived transforms and large render surfaces still need profiling and selective memoization/extraction.
- **Legacy Layout global search**: still effect-driven and can generate avoidable fetch work compared with PlatformShell patterns.
- **Route transition prefetching**: top navigation targets are not yet prefetched.
- **Automated regressions**: request-count and render-timing assertions should be added for top flows.
- **Long-list virtualization**: evaluate for large-firm dockets/worklist views once profiling data is captured.

## Backend query optimization addendum (April 23, 2026)

### Backend hotspots profiled
- `GET /api/cases` (All Dockets)
- `GET /api/worklists/employee/me` (My Worklist)
- `GET /api/worklists/global` (Workbasket queue)
- Dashboard summary service queries
- Reports list/export endpoints

### Improvements shipped
- Reduced overfetching with stricter projections on case lists and report queries.
- Added stable tie-break sorting (`_id`) on high-volume list endpoints to keep pagination deterministic.
- Reduced duplicated work in global worklist SLA ordering path while preserving current response semantics.
- Added slow-path backend instrumentation for case/worklist/dashboard/report query timings.

### Index alignment
- Added compound indexes for assignee+status+recency, subcategory filters, and owner/routed workbasket SLA sorting patterns.
