## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.

## 2026-06-13 - [Revert $facet for simple counts]
**Learning:** While the $facet aggregation groups multiple queries into a single network roundtrip, it is an anti-pattern for multiple simple counts because it forces MongoDB to load all documents into memory. This causes the query to skip indexes and risk hitting the 100MB aggregation limit.
**Action:** Replace $facet count queries with concurrent `countDocuments()` calls using `Promise.all()`, which allows MongoDB to optimize using index scans.
