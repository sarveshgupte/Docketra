## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.
## 2026-06-12 - Prevent N+1 Query in Bulk Operations
**Learning:** During bulk uploads involving generation of nested or default parent documents, loop-invariant database dependencies (such as finding categories or configurations via nested callbacks) and iterative `findOne` / `save` operations on individual identifiers degrade performance from O(1) database queries to O(N).
**Action:** Lift invariant fetches outside bulk processing loops. Pre-fetch existing constraints (like `idempotencyKey` deduplication checks) via a single `$in` query mapping them into an in-memory structure (e.g. `Set` or `Map`). Collect newly instantiated documents into an array and persist them concurrently via `.insertMany(docs, { ordered: false })` at batch boundaries to mitigate network and CPU overhead.

## 2024-05-24 - Avoid $facet for independent metric slices
**Learning:** Using $facet to compute distinct data slices or multiple statistical counts forces MongoDB to pull all matching documents into memory to evaluate sub-pipelines, bypassing indexes and risking the 100MB aggregation memory limit.
**Action:** Replace $facet with a primary aggregation for the main dataset combined with independent, concurrent countDocuments queries via Promise.all() to enable fast index scans for each distinct slice.
