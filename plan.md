1. **Remove Duplicate Schema Indexes**
   - Address the mongoose warning about duplicate schema indexes. Remove the explicit `caseSchema.index` definitions for `isInternal`, `workType`, `state`, and the duplicate `{"firmId":1,"status":1,"createdAt":-1}`.

2. **Fix Secret Scanner Gitleaks Error**
   - Address the gitleaks warning regarding hardcoded master encryption key. Replace `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` with a gitleaks-allowed placeholder, `<required-encryption-key-64-chars>`.

3. **Verify Changes and Run Tests**
   - Run tests to confirm the secret scanning passes and the tests aren't broken by the mocked encryption key change.

4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**

5. **Create PR**
   - Submit the PR with the exact title `⚡ Bolt: [performance improvement]` and the exact headers `💡 What:`, `🎯 Why:`, `📊 Impact:`, and `🔬 Measurement:`.
