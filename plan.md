1. **Optimize `bulkReassignDockets` in `src/controllers/capacity.controller.js`**
   - Identify the N+1 latency issue where `await reassignCase()` is called sequentially in a loop.
   - Replace the sequential loop with a chunked batch processing approach using `Promise.allSettled()` to allow for concurrent execution of the operations while limiting the batch size (e.g., chunks of 50) to prevent pool exhaustion.

2. **Update tracking journal**
   - Add the specific learning and action text to `.jules/bolt.md` reflecting the optimization made for `bulkReassignDockets`.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run linter and tests (`pnpm lint`, `pnpm run test:pure`) to verify changes don't break existing functionality.

4. **Submit the PR**
   - Provide a clear PR title and description indicating the expected performance improvement in bulk reassignments.
