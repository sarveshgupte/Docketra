1. **Optimize firm client validation in `src/controllers/admin.controller.js`**
   - In `updateUserClientAccess`, the current implementation validates that all selected `normalizedClientIds` belong to the admin's firm by querying `Client.countDocuments` and verifying the count equals `normalizedClientIds.length`.
   - Then, just a few lines later, if `accessMode === 'SELECTED'`, it issues another database query `Client.find().select('_id').lean()` using the exact same filters to get the ObjectIds for `newClientAccess`.
   - **Performance Win:** Combine these into a single database operation! Use `Client.find(query).select('_id clientId').lean()` to fetch the matching documents once. Then, assert that `fetchedClients.length === normalizedClientIds.length` to validate ownership, and directly map the `_id`s to populate `newClientAccess`.
   - This eliminates one unnecessary database roundtrip (O(1) savings per request), dropping sequential query bottlenecks during user client access updates.

2. **Add inline comments explaining the performance optimization**
   - Add "💡 What:", "🎯 Why:", and "📊 Impact:" comments to document the removal of the redundant `countDocuments` query.

3. **Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run `pnpm lint` and `pnpm test` (or the equivalent API test runner command).

4. **Document critical learning in Bolt's journal**
   - Add a journal entry to `.jules/bolt.md` documenting the optimization pattern of merging sequential `countDocuments` validation checks and subsequent `find` retrieval queries into a single `find` operation.

5. **Create a Pull Request**
   - Title: `⚡ Bolt: [performance improvement] Eliminate redundant countDocuments query during client access validation`
   - Description matching Bolt's format (What, Why, Impact, Measurement).
