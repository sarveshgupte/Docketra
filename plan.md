1. **Explore the codebase** to identify potential performance bottlenecks.
2. **Implement optimization** in `src/controllers/capacity.controller.js` to run multiple sequential database queries (`reassignCase` operations) concurrently using `Promise.all()`.
3. **Verify the change** by running format and linting, then executing the test suite to ensure correctness.
4. **Log the findings** in `.jules/bolt.md` documenting the optimization.
5. **Complete pre-commit steps** to verify requirements and dependencies before finalizing.
6. **Submit PR** with an appropriate commit message referencing the performance improvement.
