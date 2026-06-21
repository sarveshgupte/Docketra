1. **Analyze the performance bottleneck:**
   In `src/controllers/docketWorkflow.controller.js`'s `moveDocket` function, queries to fetch `managerOwnedTeams` and `managedUsers` are executed unconditionally:
   ```javascript
   const managerOwnedTeams = await Team.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('_id').lean();
   const managedUsers = await User.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('xID').lean();
   ```
   These queries are expensive and unnecessary if the user is a `PRIMARY_ADMIN` or `ADMIN`, because `canMoveDocketBetweenQueues` immediately returns `true` for these roles (bypassing the `managerScope` check entirely).

2. **Implement the optimization:**
   Modify `src/controllers/docketWorkflow.controller.js` to only fetch the `managerOwnedTeams` and `managedUsers` if the user is a `MANAGER`. We can check the user's role early.

   ```javascript
   let managerScope = {};
   if (String(req.user?.role || '').trim().toUpperCase() === 'MANAGER') {
     const [managerOwnedTeams, managedUsers] = await Promise.all([
       Team.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('_id').lean(),
       User.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('xID').lean()
     ]);
     managerScope = {
       permittedTeamIds: [...new Set([
         ...(Array.isArray(req.user?.teamIds) ? req.user.teamIds : []).map((id) => String(id)),
         ...managerOwnedTeams.map((team) => String(team._id)),
       ])],
       permittedUserXids: [...new Set([
         String(req.user?.xID || '').toUpperCase(),
         ...managedUsers.map((user) => String(user.xID || '').toUpperCase()),
       ])],
     };
   }
   ```
   *Also using `Promise.all` for concurrency in case they are needed for managers.*

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run linter and tests (`pnpm lint` and `pnpm test`).
   - Create the journal entry for this learning.
   - Run `pre_commit_instructions` tool to complete steps.

4. **Submit PR:**
   - Commit the changes and request PR approval with the title "⚡ Bolt: [performance improvement]" and necessary descriptions.
