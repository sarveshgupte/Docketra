1. **Optimize `getRiskBrief` in `src/services/dashboard.service.js`:**
   - There are multiple independent asynchronous calls in `getRiskBrief` inside `src/services/dashboard.service.js`.
   - Specifically, `Case.countDocuments` for `stalePending` is currently called *after* `Promise.all` which executes other concurrent queries like `atRiskEntities`, `waitingClient`, `awaitingApproval`, `overloadedAssigneesRaw`, and `blockedTaxonomyRaw`.
   - I will merge the `stalePending` query into the single `Promise.all` block to execute all independent database queries concurrently, reducing overall latency.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**

3. **Submit PR:**
   - Submit the PR with the title '⚡ Bolt: [performance improvement]' and include headers '💡 What:', '🎯 Why:', '📊 Impact:', and '🔬 Measurement:' describing the improvement.
