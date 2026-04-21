# Frontend Data Fetching Patterns (April 2026)

## Approved approach for platform pages
- Use **TanStack React Query** as the shared fetching layer for platform surfaces.
- Prefer `useQuery` hooks in `src/hooks` over ad hoc `useEffect + useState` network calls in page components.
- Keep query keys stable and semantic (`['platform', 'workbench']`, `['platform', 'reports-metrics']`).

## Cached data vs blocking loads
- **Block only on first load** (`isLoading`) when there is no prior data.
- On revisit or manual refresh, keep current rows/cards visible and show scoped refresh state (`isFetching`) instead of full-screen loaders.
- Use `placeholderData: keepPreviousData` for list/summary surfaces where prior data is safe to display while refetching.

## Background refresh behavior
- Use stale times by surface risk and volatility:
  - Dashboard + queue lists: ~90s stale window.
  - Reports summaries: ~120s stale window.
- Manual refresh buttons should call `refetch()` and preserve visible data.
- Avoid `refetchOnWindowFocus` churn for every tab switch (already disabled globally in query client).

## Avoiding duplicate requests
- Centralize API calls per surface in shared hooks so multiple pages reuse the same cache.
- Instrument request fan-out and slow calls with `trackAsync` (`src/utils/performanceMonitor.js`) to flag:
  - duplicate in-flight request keys
  - slow responses over threshold
- Command-center search should cache query results per search term and avoid reloading client directory on every keystroke.

## Guidance by page type

### List pages (All Dockets / Workbench / My Worklist / QC Workbench)
- Query once via shared hook.
- Perform client-side filters (`search/status/category`) on cached rows.
- Keep table visible during background refetch; scope loading to refresh affordances.

### Detail pages
- Use case-specific query key by docket ID.
- Keep previously fetched record while background-updating when reopening the same docket.
- Avoid resetting local view state unless route ID changes.

### Dashboard summaries
- Fetch summary via dedicated dashboard query key.
- Derive cards from cached summary object and refresh in background.
- Avoid duplicate summary requests from sibling pages by reusing query cache.

### Command-center search
- Debounce input.
- Ignore stale responses with request IDs.
- Cache search results by normalized term for repeat queries in same session.
- Load static-ish supporting datasets (e.g., client directory) once per open session and filter locally.
