## 2024-07-26 - Optimize N+1 query loop with $in query and bulk insertMany
**Learning:** Found an N+1 query bottleneck in `src/controllers/workbasket.controller.js` where a `Team.findOne` was performed inside a loop over all PRIMARY workbaskets. This led to excessive DB round-trips. Furthermore, when a workbasket was missing, a separate `create` was fired inside the loop.
**Action:** Lift the query out of the loop and utilize the `$in` operator with a single `find` to check existence of multiple linked QC teams. Combine missing elements into a single `insertMany` to minimize network roundtrips to O(1) and improve scaling for firms with lots of workbaskets.

## 2024-07-28 - Skip unnecessary RBAC queries in docket moves
**Learning:** In `docketWorkflow.controller.js`'s `moveDocket` function, expensive queries fetching `managerOwnedTeams` and `managedUsers` were being executed unconditionally for all user roles. However, `canMoveDocketBetweenQueues` immediately allows PRIMARY_ADMIN and ADMIN roles, making these queries entirely redundant for those users.
**Action:** Lift the RBAC scope queries behind a conditional check to execute only for the 'MANAGER' role, and combine them into a concurrent `Promise.all` block to eliminate unnecessary database round-trips for admin users.
