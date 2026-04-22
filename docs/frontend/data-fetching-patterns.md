# Frontend Data Fetching Patterns (April 2026)

## Approved approach for platform pages
- Use **TanStack React Query** as the shared fetching layer for platform surfaces.
- Prefer `useQuery` hooks in `src/hooks` over ad hoc `useEffect + useState` network calls in page components.
- Keep query keys stable and semantic (`['platform', 'workbench']`, `['platform', 'reports-metrics']`).
- Keep product naming consistent with Docketra terminology ("dockets", "workbench", "worklist").

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

## Duplicate fetches removed in April 2026 pass
- **Dashboard / Task Manager overlap**: dashboard summary was previously fetched separately in multiple page-level effects on mount; now both pages reuse shared query keys and cache state.
- **Workbench / My Worklist / QC / Reports mount churn**: each page previously re-fetched on every mount via local effects with no reuse; now each surface uses shared query hooks and cache-backed revisit behavior.
- **Command-center client lookup**: client list fetch was repeatedly triggered during search interactions; now client directory is loaded once and filtered in-memory for subsequent search terms.
- **Notification polling overlap**: polling and socket updates could overlap and issue redundant requests; now in-flight and recency guards reduce overlap.

## Loading-state standards
- Use `isLoading` only for first paint placeholders.
- Use `isFetching` + scoped refresh notice for background refreshes.
- Avoid clearing existing table/card data on transient fetch errors when stale data is still available.
- Keep shell/layout stable during route transitions; avoid full-page spinner swaps unless there is no safe cached data.

## Guidance by page type

### List pages (All Dockets / Workbench / My Worklist / QC Workbench)
- Query once via shared hook.
- Perform client-side filters (`search/status/category`) on cached rows.
- Keep table visible during background refetch; scope loading to refresh affordances.

### Detail pages
- Use docket-specific query key by docket ID.
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

## Next-PR implementation checklist
- Add route-level prefetch for top navigations from Dashboard and Docket Workbench.
- Convert remaining legacy pages with manual effect-based fetches to shared hooks.
- Add request-count assertions for high-traffic routes to prevent regressions.
- Profile and optimize heavy list transforms in All Dockets for large firm datasets.
