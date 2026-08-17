1. **Optimize Dashboard Approval Counts Queries**
   - The `src/services/dashboard.service.js` function `getApprovalsDash` currently performs four concurrent `Case.countDocuments` and a separate `Case.find()` query sequentially.
   - Wait, `Case.find()` is at line 860. The `Promise.all` for counts is at line 845.
   - We can merge the `Case.find()` query into the `Promise.all` array at line 845 to execute all 5 queries concurrently, eliminating a sequential network roundtrip.

   - Let's check lines 845-865 of `src/services/dashboard.service.js`:
     ```javascript
     const [myApprovals, awaitingPartner, awaitingClientSignatory, overdueApprovals] = await Promise.all([ ... ]);
     const queueFilter = getApprovalQueueFilter(...);
     const listQuery = { ... };
     const items = await Case.find(listQuery)...
     ```
   - By constructing `queueFilter` and `listQuery` *before* the `Promise.all`, we can include the `Case.find()` query in the array.

2. **Verify changes**
   - Run `node -c src/services/dashboard.service.js`.
   - Run `pnpm run test:integrity`.

3. **Complete pre-commit steps**

4. **Submit PR**
   - Title: "⚡ Bolt: Optimize dashboard approval queries by grouping independent find and counts"
