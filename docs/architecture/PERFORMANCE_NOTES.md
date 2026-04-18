# Performance Notes (Free-Tier Focus)

## Scope

These optimizations focus on code-level wins for constrained infrastructure:

- Render free-tier backend (cold starts possible)
- MongoDB free-tier (limited throughput/index budget)

No hosting/provider changes are required.

## What was optimized

### Frontend perceived speed

- CRM leads now use local state patching after create/update flows instead of forcing full list reloads.
- Lead stage transitions use optimistic updates with safe rollback on request failure.
- CRM/CMS refresh actions now keep prior content visible and use localized loading indicators.
- Route loading shell includes clearer startup messaging to reduce “broken-feeling” during cold start delays.

### Frontend caching and refetch discipline

- Increased React Query default `staleTime`/`gcTime` to reduce remount churn for short navigation loops.
- Disabled automatic refetch on window focus at the global query-client level to avoid noisy, high-frequency refetch behavior.
- Dashboard widget queries now retain previous data and use explicit cache windows.
- Category metadata query was split from docket list query and cached independently (long-lived reference data).

### Backend/API hot-path improvements

- Lead list endpoint now uses explicit projection for list-oriented responses, reducing payload weight.
- Lead update endpoint skips writes when incoming updates do not change persisted values.
- Added targeted lead indexes for firm-scoped owner/stage/follow-up query paths.

## Hot paths improved

- CRM Leads page (list + stage updates + detail updates + create lead)
- CMS intake queue refresh behavior
- Dockets list category metadata fetch behavior
- Dashboard widget and setup-status fetch stability

## Known limitations on free-tier infra

- Cold starts on Render free-tier still exist; copy and loading UX are improved, but wake-up latency cannot be fully removed in code.
- MongoDB free-tier can still see slower performance under burst traffic; indexes are intentionally conservative to avoid over-indexing.
- Some highly dynamic datasets still require refetch for correctness/security and should not be aggressively cached.
