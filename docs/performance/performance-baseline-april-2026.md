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
