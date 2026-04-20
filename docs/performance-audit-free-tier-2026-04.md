# Docketra Free-Tier Performance Audit (April 2026)

## Bottlenecks identified

1. **Dashboard initial load made 4 parallel summary calls** from the UI (`myDockets`, `overdueDockets`, `recentDockets`, `workbasketLoad`) even though the backend already supports returning all widgets in one request.
2. **Worklist endpoint returned unpaged data** (limit-only), so large assignee queues could create heavy initial payloads and slower table paint.
3. **Clients list endpoint returned full result sets** and lacked server-side pagination/search, increasing DB read load and transfer size as firms scale.
4. **No explicit slow-request diagnostics** for isolating hot endpoints in production.
5. **Mongo connect path could reconnect under repeated startup code paths** instead of safely reusing in-flight connection setup.

## Indexes added

- `Case`:
  - `{ firmId: 1, workType: 1, status: 1, createdAt: -1 }`
  - `{ firmId: 1, assignedToXID: 1, workType: 1, status: 1, createdAt: -1 }`
- `Client`:
  - `{ firmId: 1, isActive: 1, businessName: 1, clientId: 1 }`

## Endpoints optimized

- `GET /api/dashboard/summary`
  - Frontend now requests all widgets in a single query instead of multiple `only=` calls.
- `GET /api/worklists/employee/me`
  - Added server-side pagination (`page`, `limit`) with pagination metadata.
- `GET /api/clients`
  - Added server-side pagination (`page`, `limit`) and optional server-side search (`search`) while preserving existing response shape.

## Frontend caching/loading improvements

- Dashboard now uses a **single React Query key** for summary data, reducing duplicate network chatter and backend load.
- Worklist table now paginates from server data and avoids loading long queues upfront.
- Clients table now supports debounced search and server pagination.
- Pagination controls preserve existing navigation and table behavior.

## Before/after notes on key pages

- **Dashboard**: 4 requests ➜ 1 request for initial widget hydration.
- **My Workload (Worklist)**: potentially large unbounded list ➜ paginated server fetch with fixed page size.
- **Client Lists**: full list fetch ➜ paginated + searchable fetch.
- **All Dockets / Detail Views**: no functional changes in this pass; existing docket list pagination and detail sub-pagination remain active.

## Remaining free-tier infra limits

1. **Render cold starts** still impact first-request latency after inactivity.
2. **Free-tier Mongo shared cluster variability** can still produce periodic query jitter.
3. **No dedicated cache tier required/added**; short-term Redis cache usage remains optional and best-effort in existing dashboard path.
4. **High-cardinality full-text/regex searches** may still be expensive for very large tenants without paid-tier compute.

## Safety and compatibility notes

- No paid infrastructure introduced.
- No Redis dependency introduced.
- Existing API fields preserved; added pagination/search is backward compatible.
