# Perceived Speed Playbook (Free-tier safe)

_Last updated: April 25, 2026_

This playbook defines the low-risk defaults we use to keep Docketra responsive on slower Render/Mongo free-tier plans without adding paid infrastructure.

## Frontend caching rules (React Query)

### 1) Query defaults
- Global defaults live in `ui/src/queryClient.js`.
- Baseline:
  - `staleTime: 60s`
  - `gcTime: 10m`
  - `refetchOnWindowFocus: false`
  - `refetchOnMount: false`
  - `retry: 1`
- Why: avoid route/remount churn and repeated loading flashes while still allowing explicit refresh actions.

### 2) Route-level policy by page
- **Dashboard** (`useDashboardSummaryQuery`, `useDashboardWidgetQuery`)
  - `staleTime: 2m`, `gcTime: 20m`, no refetch-on-focus/mount.
  - Keep previous data while filter/sort/page changes.
- **Dockets list** (`useCasesListQuery`)
  - `staleTime: 90s`, `gcTime: 20m`, no refetch-on-focus/mount.
  - Keep previous page data to avoid table flashes.
- **Docket detail** (`useCaseQuery`)
  - `staleTime: 90s`, `gcTime: 20m`, no refetch-on-focus/mount.
  - Polling is opt-in and context-aware (hidden tab/offline disables polling).
- **Reports dashboard** (`useReportsDashboardQuery`)
  - `staleTime: 3m`, `gcTime: 20m`, no refetch-on-focus/mount.
  - Metrics endpoints load in parallel.
- **Clients / Admin**
  - Still primarily imperative in parts of the surface.
  - Rule: prefer preserving prior table rows during refresh and avoid full-screen blockers.

### 3) Loading UX
- Prefer **skeleton rows/cards** over full-screen loaders for list/card surfaces.
- Keep existing data visible during background fetch (`isFetching`) and show lightweight “Refreshing…” hints.

### 4) Safe optimistic UI
- Use optimistic updates only for low-risk, reversible actions.
- Current usage:
  - Docket “Assign to me” updates visible rows immediately and rolls back on API failure.

### 5) Request deduplication
- React Query deduplicates in-flight requests by query key.
- Use shared key builders (`getCaseQueryKey`) for detail/prefetch parity.
- Keep API-level coalescing/cache for docket detail (`caseApi.getCaseById`) enabled.

## Backend pagination, projection, and query rules

### 1) Pagination
- Every list/report endpoint should accept `page` + `limit` with bounded max limits.
- Current rule-of-thumb:
  - default `limit`: 25–50
  - max `limit`: 200–250 for regular lists, with explicit cap checks.

### 2) Projection + lean
- Always select only required fields for list/report responses.
- Use `.lean()` on read-only list/report paths to reduce hydration overhead.
- Avoid shipping large nested payloads for index/list pages.

### 3) Query shape and indexes
- Add indexes only when query pattern is stable and repeated.
- Document the query pattern inline with the index comment.
- New justified index in this pass:
  - `Case: { firmId: 1, status: 1, pendingUntil: 1 }`
  - supports pending report filter + chronological pending queue sort.

### 4) Pending report behavior
- `GET /api/reports/pending-cases` now supports `page` and `limit` with validation.
- Maintains tenant scope and row caps while returning pagination metadata.

## Practical verification checklist

Use this before merging performance touches:

1. Navigate Dashboard ⇄ Dockets ⇄ Docket Detail quickly:
   - no full-screen reloads between short revisits
   - stale-but-usable data appears instantly
2. Hover/prefetch a docket row, then open it:
   - fewer perceived waits, no duplicated detail fetch storm
3. Run reports dashboard twice in a row:
   - first load can be slow, second load should feel immediate
4. Trigger assign-to-me:
   - row updates instantly, and rollback occurs on simulated failure

## Non-goals for this playbook

- No Redis, queue workers, CDN rewrites, or paid infra dependencies in this pass.
- No material behavior/permission changes to docket lifecycle logic.
