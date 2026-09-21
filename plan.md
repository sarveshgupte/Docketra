1.  **Refactor `assertFirmPlanCapacity` in `src/services/user.service.js`:**
    *   Currently, `Firm.findById` is awaited, then `User.countDocuments` (total users) is awaited.
    *   If the plan is "starter" and role is "ADMIN" or "PRIMARY_ADMIN" and `incrementBy > 0`, it awaits *another* `User.countDocuments` (admin users).
    *   Since the number of user queries depends on the input `role` and `incrementBy`, but does NOT depend on the `firm` query result, we can run `Firm.findById` and the `User.countDocuments` query/queries concurrently using `Promise.all`.
    *   Wait, the plan limits *do* depend on `firm.plan` and `firm.maxUsers`, but the query for `User.countDocuments` only depends on `firmId` which is provided.
    *   So we can fetch `firm`, `count` (total active/invited users), and optionally `adminCount` (if role is admin/primary_admin and incrementBy > 0) all in parallel.
2.  **Update `.jules/bolt.md` journal:**
    *   Add an entry explaining the optimization of combining independent `Firm.findById` and `User.countDocuments` queries into a single `Promise.all` block.
3.  **Run tests and pre-commit checks:**
    *   Verify syntax and tests pass.
4.  **Submit PR:**
    *   Create PR with title "⚡ Bolt: [performance improvement]"
    *   Add descriptive body following the required template.
