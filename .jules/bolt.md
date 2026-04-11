## 2024-05-10 - O(N) Sequential Query Elimination in Tenant-Scoped APIs
**Learning:** In tenant-scoped APIs where parent and child models (e.g., `WorkType` and `SubWorkType`) both share a `firmId` for tenancy isolation, it's often an anti-pattern to query the parent first and then query the child using an `$in` array of parent IDs. If both models also share the exact same status filters (e.g., `isActive: true`), you can fetch all matching parents and children concurrently via `Promise.all` using just the `firmId` and status filter. The application logic can safely group the results in-memory.
**Action:** Always scrutinize sequential queries where the second query uses IDs from the first query. If both queries are strictly tenant-bound (using the same `firmId` and filters), convert them to concurrent `Promise.all` queries to reduce database roundtrips from O(N) to O(1).

## 2026-04-11 - [Optimize superadmin stats endpoint]
**Learning:** Sequential `countDocuments` calls to unrelated collections (Firm, Client, User) in dashboard metrics endpoints significantly increase request latency and block the Node event loop sequentially.
**Action:** Always combine independent MongoDB queries (e.g. `countDocuments`, `find`) using `Promise.all` in dashboard and analytics endpoints to fetch data concurrently.
