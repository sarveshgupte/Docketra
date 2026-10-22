1. **Add `title` to icon-only buttons in `ui/src/pages/KnowledgeLibraryPage.jsx`**
   - Specifically, in three places:
     - The `aria-label="Close detail drawer"` close button around line 623
     - The `aria-label="Close form panel"` close button around line 1609
     - The `aria-label="Close detail drawer"` close button around line 1659
   - Use `replace_with_git_merge_diff` to add the `title` attributes matching the `aria-label`.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run `pnpm lint` and `pnpm test`
   - Address any issues.

3. **Submit the Pull Request**
   - Title: `🎨 Palette: [UX improvement]`
   - Description matching guidelines.
