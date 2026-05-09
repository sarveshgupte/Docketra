💡 What: Replaced sequential N+1 database queries in `handleUserDeactivation` with O(1) batched lookups.

🎯 Why: When a user with many assigned dockets is deactivated, the workflow service iterates over every docket and performs sequential `Category.findOne` and `Team.findOne` queries to resolve the fallback workbasket. If a user has 500 dockets, this previously triggered 1,000 separate synchronous database queries, blocking the event loop and potentially timing out the deactivation endpoint.

📊 Impact: Reduces database queries during user deactivation from O(2N) to O(2), significantly reducing latency and mitigating the risk of timeouts for users with large workbaskets.

🔬 Measurement: Verifiable by monitoring database query volumes and endpoint latency for the user deactivation flow. The unit tests (`npm run test:pure`) remain green, confirming that the business logic and normalization behaves exactly the same.
