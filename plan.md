1. **Analyze `src/services/caseQuery.service.js`:**
   - Locate the `runPaginatedFacet` function.
   - It currently uses `model.aggregate([{ $match: match }, { $facet: { ... } }])` to perform a paginated fetch along with a total count.
   - The memory note says "While $facet groups multiple count operations into a single network roundtrip, it is an anti-pattern for simple counts if the initial $match yields a large dataset. Individual countDocuments queries can be resolved entirely using index scans, whereas $facet forces MongoDB to pull all matching documents into memory...".
2. **Implement Optimization:**
   - Change `runPaginatedFacet` to execute a `Promise.all` containing `model.find(match).sort(sort).skip(skip).limit(limit + 1).select(project).lean().maxTimeMS(8000).exec()` and `model.countDocuments(match).maxTimeMS(8000).exec()` instead of the `$facet` aggregation.
   - This avoids memory overhead and utilizes indexes directly for both queries.
3. **Verify:**
   - Check unit tests using `pnpm test` or the appropriate test script.
   - Check linting using `pnpm lint`.
4. **Complete Pre-Commit Steps:**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
5. **Submit PR:**
   - Create a PR using the required Bolt template.
