## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.
## 2026-06-07 - Optimize sequential DB queries with Promise.all
**Learning:** Found sequential independent database queries in `src/controllers/documentItem.controller.js` (`createDocumentItem` and `addDocumentVersion`) that were causing unnecessary database latency.
**Action:** When validating multiple independent models in controller methods, group them in a `Promise.all` to fetch them concurrently instead of using sequential `await` calls.
