## 2024-05-23 - Bulk Upload Category N+1 Query Optimization
**Learning:** Found an N+1 query loop for missing category records during bulk uploads where `Category.findOne` was executed per row even if categories were already pre-fetched.
**Action:** Implemented caching strategy where we query `$in` for all requested categories upfront. Instead of executing `Category.findOne` for every cache miss in the loop, we deduce that if it's not in the pre-fetched cache, it must be created, thereby eliminating the N+1 `findOne` latency.

## 2026-04-14 - Eliminating countDocuments with limit + 1
**Learning:** For hard-capped exports where we validate the total number of records does not exceed a maximum limit, executing a separate `countDocuments` query is redundant and wastes a database roundtrip.
**Action:** Replaced sequential `countDocuments()` and `find().limit(MAX)` with a single `find().limit(MAX + 1)`. If the returned array length exceeds the MAX, we know it breached the limit, saving an entire database count query.

## 2026-04-16 - Prevent N+1 Promise.all Counts with Aggregation
**Learning:** Mapping multiple concurrent `countDocuments` queries over an array of IDs inside `Promise.all` can quickly exhaust database connections or severely increase latency when the array is large (e.g., retrieving counts for many workbaskets).
**Action:** Replace `Promise.all([...countDocuments])` with a single `$aggregate` pipeline utilizing `$match`, `$unwind` (on the array), a second `$match`, and `$group` with `$sum: 1` to resolve all counts in a single network round-trip.

## 2026-04-16 - Parallelize Parent and Child Lookups in Tenant-Scoped APIs
**Learning:** In tenant-scoped endpoints where the parent entity ID is already known (e.g., from request params) and all queries use the same tenant isolation field (e.g., `firmId`), querying the parent sequentially before fetching child records (via a `Promise.all` array) is redundant and wastes a full network roundtrip.
**Action:** Merge the parent query (e.g., `CrmClient.findOne`) directly into the concurrent `Promise.all` alongside child queries (e.g., `Deal.find`, `Case.find`, `Invoice.find`) using the explicitly known ID. After the promises resolve, simply verify the parent object exists.

## 2026-04-18 - Parallelize Independent Validations in Create Endpoints
**Learning:** Validating multiple optional but independent identifiers (e.g., `dealId`, `docketId`) sequentially in a creation endpoint wastes network roundtrips.
**Action:** Prepare the Mongoose queries as promises and execute them concurrently with `Promise.all` instead of sequentially awaiting them.

## 2026-04-24 - Grouping countDocuments with $facet aggregation
**Learning:** Running multiple `countDocuments` queries concurrently (e.g., in `Promise.all`) for different subsets of the same collection still incurs multiple database round-trips and index scans.
**Action:** Use an aggregation pipeline with `$facet` to group multiple document counting queries on the same collection into a single database network round-trip.

## 2026-04-24 - $facet count vs Promise.all countDocuments
**Learning:** While using `$facet` groups multiple count operations into a single network roundtrip, it is an anti-pattern for simple counts if the initial `$match` yields a large dataset. Individual `countDocuments` queries can be resolved entirely using index scans, whereas `$facet` forces MongoDB to pull all matching documents into memory to evaluate the sub-pipelines, bypassing indexes and risking the 100MB aggregation memory limit.
**Action:** Do not replace concurrent `countDocuments` with `$facet` aggregations unless the initial `$match` is heavily constrained and the resulting dataset is known to be small. Reverting the `$facet` optimization.
