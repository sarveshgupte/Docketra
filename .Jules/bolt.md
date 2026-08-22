## 2026-08-22 - Group independent database queries concurrently
**Learning:** Sequential database queries (like a `User.countDocuments` following a `Firm.findById`) create unnecessary network latency bottlenecks. Grouping independent queries together using `Promise.all()` executes them concurrently and eliminates sequential network roundtrips.
**Action:** Identifying and eliminating unnecessary sequential database queries by grouping them into a single `Promise.all` array executes them concurrently, reducing overall network latency.
