## 2024-08-12 - Icon-only Button Tooltips
**Learning:** When improving usability of icon-only buttons that already contain `aria-label` attributes, add native HTML `title` attributes to provide explicit hover tooltips for sighted mouse users.
**Action:** Always pair `aria-label` with `title` on icon-only buttons.
## 2026-08-13 - BubbleMenu Dropdown Accessibility
**Learning:** Dropdowns and toggles with `aria-expanded` need a linked `aria-controls` pointing to a unique element ID to correctly announce state to screen readers. If there are multiple instances on a page, hardcoded IDs will conflict.
**Action:** Use React's `useId()` to generate unique IDs for dropdown menus and bind them to the toggle button's `aria-controls`.
