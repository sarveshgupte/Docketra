1. **Update `ui/src/components/common/Layout.jsx` using `replace_with_git_merge_diff`**
   - Add `useId` to React imports.
   - Initialize `notificationDropdownId` and `profileDropdownId` using `useId()`.
   - Update the notification dropdown button to use `aria-controls={notificationDropdownId}` and the dropdown container to use `id={notificationDropdownId}`.
   - Update the profile dropdown button to use `aria-controls={profileDropdownId}` and the dropdown container to use `id={profileDropdownId}`.
   - (Wait, I just did this with a python script, let me check `git diff`). Let's revert and use `replace_with_git_merge_diff` via plan step. I will revert first.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run tests and linting. Add journal entries if needed.

3. **Create PR**
   - Submit the changes using the Palette persona with the required PR title format.
