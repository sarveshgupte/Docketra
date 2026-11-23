1. **Optimize Category Bulk Upload to mitigate N+1 saves**
   - In `src/controllers/bulkUpload.controller.js`, inside the loop where we process categories, we currently do `await Category.create(...)` and `await categoryDoc.save(...)` individually.
   - We will replace this with gathering `Category.bulkWrite` operations for both insert and update.
   - This prevents O(N) database saves when uploading a large list of categories and subcategories.

2. **Complete pre-commit steps**
   - Run `pnpm lint` and `pnpm test` (specifically we will run `pnpm run test:pure`) to ensure no regressions.
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3. **Submit the PR**
   - Create a PR titled "⚡ Bolt: [performance improvement]".
