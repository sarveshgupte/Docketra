## 2026-04-11 - [Optimize superadmin stats endpoint]
**Learning:** Sequential `countDocuments` calls to unrelated collections (Firm, Client, User) in dashboard metrics endpoints significantly increase request latency and block the Node event loop sequentially.
**Action:** Always combine independent MongoDB queries (e.g. `countDocuments`, `find`) using `Promise.all` in dashboard and analytics endpoints to fetch data concurrently.
