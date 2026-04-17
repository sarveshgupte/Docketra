## 2024-05-23 - Bulk Upload Category N+1 Query Optimization
**Learning:** Found an N+1 query loop for missing category records during bulk uploads where `Category.findOne` was executed per row even if categories were already pre-fetched.
**Action:** Implemented caching strategy where we query `$in` for all requested categories upfront. Instead of executing `Category.findOne` for every cache miss in the loop, we deduce that if it's not in the pre-fetched cache, it must be created, thereby eliminating the N+1 `findOne` latency.

## 2026-04-14 - Eliminating countDocuments with limit + 1
**Learning:** For hard-capped exports where we validate the total number of records does not exceed a maximum limit, executing a separate `countDocuments` query is redundant and wastes a database roundtrip.
**Action:** Replaced sequential `countDocuments()` and `find().limit(MAX)` with a single `find().limit(MAX + 1)`. If the returned array length exceeds the MAX, we know it breached the limit, saving an entire database count query.
## 2026-04-16 - Prevent N+1 Promise.all Counts with Aggregation
**Learning:** Mapping multiple concurrent `countDocuments` queries over an array of IDs inside `Promise.all` can quickly exhaust database connections or severely increase latency when the array is large (e.g., retrieving counts for many workbaskets).
**Action:** Replace `Promise.all([...countDocuments])` with a single `$aggregate` pipeline utilizing `$match`, `$unwind` (on the array), a second `$match`, and `$group` with `$sum: 1` to resolve all counts in a single network round-trip.
