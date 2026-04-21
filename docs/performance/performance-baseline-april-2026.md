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

## What was changed
- Replaced repeated local `useEffect` fetch patterns in core platform pages with shared React Query hooks.
- Added query-level cache/reuse with stale windows and previous-data retention for queue/list surfaces.
- Switched refresh behavior from blocking table reloads to scoped background refresh states where safe.
- Reduced command-center request churn by caching term results and reusing loaded client directory.
- Reduced notification overhead by preventing polling overlap with fresh socket events and de-duping in-flight fetches.
- Added lightweight instrumentation for slow calls + duplicate in-flight detection.

## Before/after observations (qualitative)
- **Before**: each mount of high-traffic pages triggered new API calls and full loading states.
- **After**: revisiting these pages reuses cached data and refreshes in background, reducing blank-state flashes.
- **Before**: command-center often retriggered broad fetch patterns while typing.
- **After**: repeated terms hit local cache and client data is reused.
- **Before**: notifications used fixed polling regardless of recent socket events.
- **After**: polling avoids tight overlap after socket updates and skips redundant in-flight fetches.

## Remaining hotspots to tackle next
- CasesPage still has heavy render and derived-data work under large datasets; profile and split expensive transforms.
- Legacy Layout route shells should eventually converge to PlatformShell patterns to eliminate duplicate navigation behavior.
- Introduce route-level prefetch for top destinations from dashboard/workbench for near-instant transitions.
- Add automated request-count assertions in integration tests for key workflows.
