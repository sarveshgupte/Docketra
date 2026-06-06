# Performance QA Checklist (Manual)

## Test setup
- Use a firm with realistic data volume (at least 50+ dockets and 30+ clients).
- Open browser devtools network + console.

## Navigation and state continuity
1. Open **All Dockets** with filters/search/sort set.
2. Scroll to mid-list, open a docket, then use browser back.
   - Expected: previous filter/search/sort context remains.
   - Expected: scroll position is restored near prior viewport.
3. Move between multiple dockets from list.
   - Expected: first-open is faster after hover/select prefetch.

## Mutation responsiveness
1. In docket detail, add comment / update status / assign action.
   - Expected: no full-page white flash.
   - Expected: only affected panel updates; shell stays stable.
2. In clients page, edit client and toggle status.
   - Expected: row updates without mandatory full list reload.
3. In client fact sheet modal, upload/delete attachment.
   - Expected: attachment section updates cleanly; no hard refresh.

## API chatter checks
- Verify console warnings for duplicate in-flight requests are absent during normal flows.
- Verify slow API logs appear only for genuinely slow requests (`[perf] Slow API response`).

## Queue performance regression checks (All Dockets / Worklist / Workbasket / QC)
1. Open **My Worklist**, type in search rapidly, then change sort and category.
   - Expected: table does not blank between transitions.
   - Expected: “Refreshing worklist…” appears while prior rows remain visible.
   - Expected: network calls use server params (`search`, `category`, `subcategory`, `sortBy`, `sortOrder`) and avoid duplicate bursts.
2. Open **Workbasket**, change filter chips and page quickly.
   - Expected: no full-page skeleton reset after initial load.
   - Expected: “Refreshing workbasket…” appears for in-place updates.
3. Hover likely target rows in **Worklist**, **Workbasket**, and **QC Workbench**.
   - Expected: detail prefetch request appears once per row intent (no request storm).
   - Expected: opening the docket from hovered rows feels faster than cold-open rows.
4. Validate queue basics after optimization:
   - filters, sorting, pagination, row actions, and keyboard open behavior remain functional.
   - browser back from detail restores a stable list state.
   - no sticky-header/selection/scroll regressions.

## Route transition checks
- Navigate dashboard ↔ dockets ↔ clients ↔ reports.
- Verify `[perf] Route transition` logs emit with path pairs and timings.
- Confirm side nav active state matches destination route during transitions.

## Regression checks
- Role-based permissions continue to gate admin-only actions.
- Firm-scoped routing remains intact.
- Optional services disabled (e.g., AI) do not break primary workflows.
