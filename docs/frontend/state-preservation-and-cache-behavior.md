# State Preservation and Cache Behavior

## Goals
Users should not lose working context when drilling into detail pages and returning to lists.

## Preserved list context
For core list/detail navigation (dockets and clients), preserve when practical:
- Filter/search state via URL query params.
- Pagination state via URL query params.
- Scroll position on back/forward navigation via session-scoped scroll cache.

## Dockets behavior
- Docket list query state remains encoded in the URL.
- Opening a docket carries `returnTo` route intent.
- Hover prefetch warms the detail cache for likely next-open dockets.

## Clients behavior
- Clients list keeps `page` and `q` in query params.
- Background refresh does not clear existing rows.
- Client mutations update in-memory list rows where possible; full reload is no longer the default path for every mutation.

## Cache invalidation philosophy
- Invalidate only the affected resource slice.
- Prefer patching local state for deterministic changes (status toggle, local fact-sheet metadata updates).
- Use background refresh for eventual consistency without blocking primary UI.

## Safety notes
- Optimistic updates are conservative and bounded to fields confirmed by the mutation payload/response.
- Critical business transitions still reconcile against backend responses.
