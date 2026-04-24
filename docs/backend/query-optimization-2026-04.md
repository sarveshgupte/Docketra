# Backend Query Optimization Pass — April 2026

## Scope
This pass focused on backend query latency and payload trimming for high-traffic operational workflows without changing business behavior.

## Endpoints/profiled paths
- `GET /api/cases` (All Dockets / registry list).
- `GET /api/worklists/employee/me` (My Worklist).
- `GET /api/worklists/global` (Workbasket / global queue).
- Dashboard query services used by `GET /api/dashboard/summary`:
  - `getMyDockets`
  - `getOverdueDockets`
  - `getRecentDockets`
  - `getWorkbasketLoad`
- Reports:
  - `GET /api/reports/pending-cases`
  - `GET /api/reports/cases-by-date`
  - `GET /api/reports/export/csv`
  - `GET /api/reports/export/excel`

## Slow query patterns found
- List endpoints fetched full case/client documents where only compact list fields were needed.
- Some list queries had unstable sort tie-breaking on high-volume pages.
- Global worklist path for SLA ordering used multiple sequential list queries + separate count path.
- Dashboard/reports had no targeted slow-path logging to isolate heavy tenant/query combinations in production.

## Index changes
Added focused compound indexes aligned to real list filter + sort patterns:
- `{ firmId: 1, assignedToXID: 1, status: 1, createdAt: -1 }` for My Worklist.
- `{ firmId: 1, assignedToXID: 1, subcategory: 1, status: 1, createdAt: -1 }` for worklist subcategory filtering.
- `{ firmId: 1, assignedToXID: 1, caseSubCategory: 1, status: 1, createdAt: -1 }` for legacy subcategory field compatibility.
- `{ firmId: 1, ownerTeamId: 1, status: 1, slaDueAt: 1, createdAt: -1 }` for owner workbasket queue sorting.
- `{ firmId: 1, routedToTeamId: 1, status: 1, slaDueAt: 1, createdAt: -1 }` for routed workbasket queue sorting.

## Query / payload reductions implemented
- Tightened `GET /api/cases` list projection to list-safe fields only and stabilized sort with `_id` tie-break.
- Tightened client batch hydration projection in case list to only UI-required fields.
- Tightened report projections to only export/report columns used in responses.
- Reused dashboard projection constant and reused firm ObjectId construction per request path.
- Refactored global worklist SLA-sort branch to avoid redundant list-query fanout and keep a consistent paged result path.

## Pagination / count / sort improvements
- Added deterministic secondary `_id` sort for key list paths.
- Preserved API response shape while reducing duplicate query work in global worklist SLA ordering.
- Retained count metadata contracts but reduced duplicated list-path work where safe.

## Observability additions
Added targeted, threshold-based warnings (no PII payloads):
- `[CASE_LIST_SLOW]`
- `[WORKLIST_QUERY_SLOW]`
- `[DASHBOARD_QUERY_SLOW]`
- `[REPORT_QUERY_SLOW]`

Each log includes endpoint/query name, duration, threshold, tenant/user identifiers only.

## Manual QA steps
1. Open **All Dockets**, apply status/category/client filters, paginate, verify total/pagination still correct.
2. Open **My Worklist**, test search/category/subcategory/sort combinations and ensure results/sort are unchanged.
3. Open **Workbasket / Global Worklist**, validate own vs routed tab, SLA sort ordering, and pagination.
4. Load **Dashboard** and verify all widgets render with same counts/items as before.
5. Run reports for pending/date-range and export CSV/Excel; verify rows and downloaded files match expected filters.
6. Verify tenant isolation by repeating from two firms and confirming no cross-tenant leakage.

## Follow-up items
- Consider replacing skip/limit with seek pagination for the largest tenants.
- Add integration benchmarks with explain-plan snapshots in CI for top list queries.
- Evaluate optional asynchronous export generation for long-running report windows.
