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
## 2026-04-28 - [Concurrent Database Validation via Promise.all]
**Learning:** The application had endpoint latency due to sequential model queries before building dependent variables. By combining `User.findOne` with other model queries inside an existing `Promise.all`, we can eliminate sequential waits.
**Action:** Always look to move sequential `findOne` operations directly into an existing `Promise.all` alongside related lookups when variables don't immediately depend on prior query resolutions.

## 2026-04-24 - Grouping countDocuments with $facet aggregation
**Learning:** Running multiple `countDocuments` queries concurrently (e.g., in `Promise.all`) for different subsets of the same collection still incurs multiple database round-trips and index scans.
**Action:** Use an aggregation pipeline with `$facet` to group multiple document counting queries on the same collection into a single database network round-trip.

## 2026-04-24 - $facet count vs Promise.all countDocuments
**Learning:** While using `$facet` groups multiple count operations into a single network roundtrip, it is an anti-pattern for simple counts if the initial `$match` yields a large dataset. Individual `countDocuments` queries can be resolved entirely using index scans, whereas `$facet` forces MongoDB to pull all matching documents into memory to evaluate the sub-pipelines, bypassing indexes and risking the 100MB aggregation memory limit.
**Action:** Do not replace concurrent `countDocuments` with `$facet` aggregations unless the initial `$match` is heavily constrained and the resulting dataset is known to be small. Reverting the `$facet` optimization.

## 2024-05-01 - Avoid duplicate countDocuments using find limit
**Learning:** Found several endpoints executing sequential `countDocuments()` and `find()` or concurrent `Promise.all([find(...), countDocuments(...)])`. This adds database load via index scans for counts and wastes network round-trips.
**Action:** Replaced sequential or concurrent `countDocuments()` queries with `find().limit(MAX + 1)` wherever pagination or a fixed hard cap makes an exact total count unneeded beyond checking if a next page or limit breach exists. This bypasses the need for the `countDocuments` index scan entirely.
## 2026-05-03 - Concurrent Document Fetch in Create Service\n**Learning:** When validating multiple optional or independent entity IDs from a request body (e.g., dealId, docketId), sequential database fetch causes high API response time.\n**Action:** Use Promise.all() for concurrent fetch instead of individual await statements.

## 2026-05-08 - Prevent N+1 loops in user deactivation logic
**Learning:** In user deactivation, iterating over a large array of dockets and waiting for sequential category and team lookups (with multiple `findOne` queries) incurs high database network latency when many cases are assigned to a single user.
**Action:** Replaced sequential `findOne` lookup in a loop with two concurrent query strategies. First, collected all unique category names and retrieved them using `$in`. Then mapped category subcategories to necessary team IDs, deduped the IDs, and retrieved all necessary workbasket Teams via an `$in` query. This eliminates N+1 latency.

## 2026-05-15 - Concurrent Document Fetch in Case Create Service
**Learning:** In the `caseCreate` service, the `User.findOne` for the resolved employee was being awaited sequentially before preparing and concurrently executing other database validation queries (`dealId`, `crmClientId`, `fallbackWorkbasket`) via `Promise.all`. This sequential structure causes high API response time.
**Action:** Use `Promise.all()` for concurrent fetching of independent database queries to eliminate unnecessary sequential waits and reduce endpoint latency.
## 2026-05-19 - [Revert $facet for simple counts in caseQuery]
**Learning:** While `$facet` groups multiple count operations into a single network roundtrip, it is an anti-pattern for simple paginated lists if the initial `$match` yields a large dataset. Individual `countDocuments` and `find` queries can be resolved using index scans concurrently, whereas `$facet` forces MongoDB to pull all matching documents into memory to evaluate the sub-pipelines.
**Action:** Use concurrent `Promise.all([find(...), countDocuments(...)])` for standard pagination instead of `$facet` aggregation pipelines.

## 2026-05-21 - Concurrent Document Fetch in Case Create Service Validation
**Learning:** In the `caseCreate` service, `WorkType.findOne` and `SubWorkType.findOne` were awaited sequentially, which caused endpoint latency, despite being independent of the other model validation queries (like `Deal`, `CrmClient`, etc.).
**Action:** Prepared the `WorkType` and `SubWorkType` queries as promises and merged them into the existing `Promise.all()` concurrently with the other independent lookups.

## 2024-06-04 - Concurrent Document Fetch in Case Create Service Validation
**Learning:** In the `caseCreate` service, `ClientRepository.findByClientId` and `categoryRepository.findActiveCategory` were awaited sequentially, which caused endpoint latency, despite being independent of the other model validation queries.
**Action:** Prepared the queries as promises and merged them into the existing `Promise.all()` concurrently with the other independent lookups.
