## 2026-04-07 - [Optimization with $facet]
**Learning:** Consolidating concurrent MongoDB queries using the $facet aggregation stage is effective for reducing network roundtrips, but I must ensure the result is correctly destructured and handled when empty.
**Action:** Use optional chaining with fallback values (e.g., `resultDoc.overdueComplianceItems?.[0]?.count || 0`) when extracting counts from a $facet aggregation result.
