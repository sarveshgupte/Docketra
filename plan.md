1. **Fix `adminSurfaceHardening.test.mjs` failure**
   - The test expects `{ value: 'USER', label: 'Employee' }` but the code has `{ value: 'Employee', label: 'Employee' }`.
   - Update `ui/src/pages/admin/components/CreateUserModal.jsx` to match the expected format for roles.
   - Use `replace_with_git_merge_diff` to update the role values.
   ```
   <<<<<<< SEARCH
           options={[
             { value: '', label: 'Select Role', disabled: true },
             { value: 'Admin', label: 'Admin' },
             { value: 'Manager', label: 'Manager' },
             { value: 'Employee', label: 'Employee' },
           ]}
   =======
           options={[
             { value: '', label: 'Select Role', disabled: true },
             { value: 'ADMIN', label: 'Admin' },
             { value: 'MANAGER', label: 'Manager' },
             { value: 'USER', label: 'Employee' },
           ]}
   >>>>>>> REPLACE
   ```
   - Verify by running `cat ui/src/pages/admin/components/CreateUserModal.jsx | grep -C 5 "Employee"`.

2. **Run Code Verification**
   - Run `pnpm lint` and `cd ui && pnpm run test:ci` to verify changes.

3. **Run Pre-Commit Checks**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

4. **Submit Pull Request**
   - Create a Pull Request with the exact title `🎨 Palette: Accessibility cleanup for Textarea and CommandPalette`.
   - The PR description should contain:
     - 💡 What: Removed duplicate accessibility attributes from `Textarea.jsx`, added missing `title` attributes to icon-only buttons in `CommandPalette.jsx`, and fixed incorrect role values in `CreateUserModal.jsx` which was causing a test failure.
     - 🎯 Why: To improve the user experience for mouse users relying on tooltips, to ensure clean semantic markup that doesn't conflict in screen readers, and to fix a broken CI test.
     - 📸 Before/After: N/A
     - ♿ Accessibility: Cleaned up duplicated `aria-expanded` and `aria-controls` properties in `Textarea.jsx`, and paired `aria-label` with `title` for buttons in `CommandPalette.jsx` to provide explicit hover tooltips.
