## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.

## 2024-07-26 - Revert $facet anti-pattern for simple counts
**Learning:** Using `$facet` to group multiple `count` operations into a single network roundtrip is an anti-pattern when the initial `$match` yields a large dataset. While it saves network latency, it forces MongoDB to pull all matching documents into memory to evaluate the sub-pipelines, bypassing indexes and risking the 100MB aggregation memory limit.
**Action:** Replace `$facet` with concurrent `Promise.all` execution of individual `countDocuments` queries so that MongoDB can resolve them entirely using fast index scans.
