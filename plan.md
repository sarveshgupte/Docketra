1. **Add tooltips to `CasesPageSections.jsx`**:
   - `ui/src/components/cases/CasesPageSections.jsx`: The saved view remove button has an `aria-label` but lacks a tooltip (`title` attribute). I will add `title="Remove saved view"` or use the existing `aria-label` content as the `title` attribute for mouse users.

2. **Add tooltips to `FirmsManagement.jsx` modal close buttons**:
   - The close buttons for the `Create Firm` and `Admin Management` modals have the character `×` but lack `aria-label` and `title`.
   - Update `ui/src/pages/FirmsManagement.jsx` to add `aria-label="Close modal"` and `title="Close modal"`.

3. **Add tooltips to `StorageSettingsPage.jsx` modal close button**:
   - The close button in `ui/src/pages/StorageSettingsPage.jsx` at line 1124 lacks `aria-label` and `title`.
   - Update it to have `aria-label="Close modal"` and `title="Close modal"`.

4. **Verify UI changes**
   - Read the changed files to verify the `replace_with_git_merge_diff` steps were applied correctly.

5. **Pre-commit and Tests**:
   - Run `pnpm lint` and `pnpm run test:ci` in `ui/`.
   - Call `pre_commit_instructions` and follow steps.

6. **Submit PR**:
   - Submit the PR with "🎨 Palette: [UX improvement]".
