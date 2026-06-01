## 2026-06-01 - Replace $facet with countDocuments for simple counts
**Learning:** The `$facet` aggregation pipeline is memory-intensive and subject to a 100MB RAM limit, bypassing index optimization for sub-pipelines.
**Action:** Replace `$facet` with concurrent `countDocuments` operations combined with `Promise.all` when querying simple counts.
