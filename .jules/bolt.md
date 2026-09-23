## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.

## 2024-07-28 - Skip unnecessary RBAC queries in docket moves
**Learning:** In `docketWorkflow.controller.js`'s `moveDocket` function, expensive queries fetching `managerOwnedTeams` and `managedUsers` were being executed unconditionally for all user roles. However, `canMoveDocketBetweenQueues` immediately allows PRIMARY_ADMIN and ADMIN roles, making these queries entirely redundant for those users.
**Action:** Lift the RBAC scope queries behind a conditional check to execute only for the 'MANAGER' role, and combine them into a concurrent `Promise.all` block to eliminate unnecessary database round-trips for admin users.
## 2026-06-12 - Prevent N+1 Query in Bulk Operations
**Learning:** During bulk uploads involving generation of nested or default parent documents, loop-invariant database dependencies (such as finding categories or configurations via nested callbacks) and iterative `findOne` / `save` operations on individual identifiers degrade performance from O(1) database queries to O(N).
**Action:** Lift invariant fetches outside bulk processing loops. Pre-fetch existing constraints (like `idempotencyKey` deduplication checks) via a single `$in` query mapping them into an in-memory structure (e.g. `Set` or `Map`). Collect newly instantiated documents into an array and persist them concurrently via `.insertMany(docs, { ordered: false })` at batch boundaries to mitigate network and CPU overhead.
## 2026-06-28 - Optimize N+1 Query in Firm Metrics
**Learning:** Replaced 5 sequential Case.countDocuments queries with a single Case.aggregate pipeline using conditional sums ($cond within $sum) to evaluate multiple metrics in a single database pass, eliminating unnecessary round-trips.
**Action:** When calculating multiple distinct counts on the same collection for the same entity, prefer a single aggregation pipeline with $sum / $cond over multiple independent count queries to reduce network latency and index load.
## 2026-08-02 - Bolt: Optimize firm calendar reminders notification loop
**Learning:** Found an N+1 query issue in `processFirmCalendarReminders` in `src/services/docketDueNotification.service.js` where `Firm.findById` and `User.find` were called inside a loop for every valid notification entry.
**Action:** Pulled the queries out of the loop and used bulk `` queries to fetch and construct maps for firms and users, reducing database queries from O(N) to O(1).
## 2026-08-09 - Optimize Boolean Presence Checks in MongoDB
**Learning:** Using `countDocuments()` for boolean presence checks (e.g., checking if count > 0) is a performance anti-pattern, as it forces MongoDB to perform a full index scan to tally all matches. Replacing it with `exists()` provides an O(1) early return upon finding the first match.
**Action:** Use `Model.exists()` instead of `Model.countDocuments()` whenever only the presence of a document is required. Ensure downstream consumers correctly handle truthiness checks, and update associated test mocks to intercept `exists()` accordingly.
## 2024-10-24 - Optimize rate limiting checks using find().limit(N)
**Learning:** Found a rate limiting check using `AuthAudit.countDocuments()` which enforces a threshold of 3. `countDocuments` forces a full index scan to aggregate all matching documents, which is inefficient when we only care if a small threshold is met.
**Action:** Replace `Model.countDocuments(query)` with `Model.find(query).select("_id").limit(N).lean()` when checking if a count exceeds a specific threshold (e.g., `>= 3`). This allows MongoDB to short-circuit and provide an O(1) early return once the limit is reached, saving significant database CPU and latency.
## 2024-03-22 - Optimizing Boolean Checks with Mongoose
**Learning:** When checking if at least one document matches a condition, using `exists()` is significantly faster than `countDocuments() > 0`. `countDocuments()` forces MongoDB to scan all matching index entries, while `exists()` returns early on the first match (O(1) time complexity).
**Action:** Always prefer `Model.exists(query)` over `Model.countDocuments(query) > 0` when the exact count is not needed, such as when seeding initial data or checking boolean presence.
## 2024-11-20 - Group independent database queries concurrently
**Learning:** Sequential database queries (like a `Case.find` following a `Promise.all` array of `Case.countDocuments`) create unnecessary network latency bottlenecks. Grouping independent queries together using `Promise.all()` executes them concurrently and eliminates sequential network roundtrips.
**Action:** Identifying and eliminating unnecessary sequential database queries by grouping them into a single `Promise.all` array executes them concurrently, reducing overall network latency.
## 2024-10-25 - Eliminate redundant sequential validation counts
**Learning:** When validating an array of IDs and immediately fetching their internal ObjectIds, performing `countDocuments()` followed by `find()` causes a redundant database roundtrip.
**Action:** Merge the sequential queries into a single `find().lean()` call, and validate by checking if `fetchedDocs.length === requestedIds.length` before mapping the results.
## 2026-08-24 - Bolt: Optimize SLA weekly summary queries
**Learning:** Replaced 6 independent `Case.countDocuments` queries inside a `Promise.all` block with a single `Case.aggregate` pipeline using conditional sums (`` within ``) in `src/services/sla.service.js`.
**Action:** When calculating multiple distinct counts on the same collection for the same entity, prefer a single aggregation pipeline with `` / `` over multiple independent count queries to reduce database network round-trips and latency.
