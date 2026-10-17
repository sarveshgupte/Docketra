## 2024-08-07 - Add tooltips to icon-only buttons
**Learning:** Found several icon-only buttons without `aria-label` attributes or explicit tooltip titles, which creates accessibility barriers and confusing user experience. Specifically, `ui/src/components/common/FirmSwitcher.jsx` has a close button with just `×`, `ui/src/components/common/AuditTimelineDrawer.jsx` has a close button with just `×`, and `ui/src/components/common/Layout.jsx` has check/cross buttons without tooltips. These are straightforward UX wins.
**Action:** Adding `aria-label` attributes (and occasionally `title`) to icon-only buttons is a crucial micro-UX improvement to enhance accessibility and provide helpful context to users.
## 2024-08-12 - Icon-only Button Tooltips
**Learning:** When improving usability of icon-only buttons that already contain `aria-label` attributes, add native HTML `title` attributes to provide explicit hover tooltips for sighted mouse users.
**Action:** Always pair `aria-label` with `title` on icon-only buttons.
## 2026-08-13 - BubbleMenu Dropdown Accessibility
**Learning:** Dropdowns and toggles with `aria-expanded` need a linked `aria-controls` pointing to a unique element ID to correctly announce state to screen readers. If there are multiple instances on a page, hardcoded IDs will conflict.
**Action:** Use React's `useId()` to generate unique IDs for dropdown menus and bind them to the toggle button's `aria-controls`.
## 2024-08-14 - Robust screen reader button labels
**Learning:** Prefer using `aria-label` on the parent `<button>` element over nesting an inner `<span className="sr-only">` to provide accessible names for icon-only buttons. The nested approach can be less robust across different screen reader and browser combinations, while `aria-label` guarantees the button has a direct accessible name. Also, always wrap literal icon characters (like ×, ✓) in `<span aria-hidden="true">` to prevent screen readers from attempting to read the raw symbol, which often results in nonsensical announcements like "times" or "multiplication sign".
**Action:** Always prefer `aria-label` directly on the button tag and use `aria-hidden="true"` on inner visual icons.
