1. **Fix IDOR Vulnerability in `updateCaseActivity` in `src/services/caseActivity.service.js`:**
   - I will use `replace_with_git_merge_diff` with exact `SEARCH` and `REPLACE` blocks:
```
<<<<<<< SEARCH
  const updateCaseActivity = async (req, res) => {
    try {
      const { caseId } = req.params;
      const { userEmail } = req.body;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: 'User email is required',
        });
      }
=======
  const updateCaseActivity = async (req, res) => {
    try {
      const { caseId } = req.params;
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: 'User email is required',
        });
      }
>>>>>>> REPLACE
```
2. **Verify changes visually:**
   - Run `sed -n '412,430p' src/services/caseActivity.service.js`
3. **Run Lint and Tests:**
   - `export JWT_SECRET=dummy SUPERADMIN_PASSWORD_HASH=dummy SUPERADMIN_XID=dummy SMTP_PASS=dummy MONGO_URI=mongodb://localhost:27017/test MASTER_ENCRYPTION_KEY=dummy && pnpm lint && pnpm test`
4. **Complete pre-commit steps:**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
5. **Submit the PR:**
   - Submit the PR with:
      - Title: "🛡️ Sentinel: [CRITICAL] Fix IDOR in updateCaseActivity"
      - Description:
      ```
      🚨 Severity: CRITICAL
      💡 Vulnerability: IDOR in `updateCaseActivity` where `userEmail` was derived from `req.body.userEmail` allowing an attacker to bypass case lock verification by spoofing their email.
      🎯 Impact: Attackers could manipulate case activity and bypass lock validation.
      🔧 Fix: Update `updateCaseActivity` to derive `userEmail` from `req.user.email` to ensure identity is cryptographically tied to the authenticated user.
      ✅ Verification: Run `pnpm test` and `pnpm lint` and inspect `src/services/caseActivity.service.js`.
      ```
