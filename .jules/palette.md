## 2024-08-07 - Add tooltips to icon-only buttons
**Learning:** Found several icon-only buttons without `aria-label` attributes or explicit tooltip titles, which creates accessibility barriers and confusing user experience. Specifically, `ui/src/components/common/FirmSwitcher.jsx` has a close button with just `×`, `ui/src/components/common/AuditTimelineDrawer.jsx` has a close button with just `×`, and `ui/src/components/common/Layout.jsx` has check/cross buttons without tooltips. These are straightforward UX wins.
**Action:** Adding `aria-label` attributes (and occasionally `title`) to icon-only buttons is a crucial micro-UX improvement to enhance accessibility and provide helpful context to users.
## 2024-08-12 - Icon-only Button Tooltips
**Learning:** When improving usability of icon-only buttons that already contain `aria-label` attributes, add native HTML `title` attributes to provide explicit hover tooltips for sighted mouse users.
**Action:** Always pair `aria-label` with `title` on icon-only buttons.
## 2026-08-13 - BubbleMenu Dropdown Accessibility
**Learning:** Dropdowns and toggles with `aria-expanded` need a linked `aria-controls` pointing to a unique element ID to correctly announce state to screen readers. If there are multiple instances on a page, hardcoded IDs will conflict.
**Action:** Use React's `useId()` to generate unique IDs for dropdown menus and bind them to the toggle button's `aria-controls`.
## 2026-11-07 - CSS-only Hover Dropdown Accessibility
**Learning:** When using CSS-only hover dropdown menus (e.g., Tailwind's `group-hover`), it's important to provide screen readers with context that the trigger button controls a menu. Since there is no JavaScript state to toggle `aria-expanded`, we cannot use it dynamically. However, adding `aria-haspopup="menu"` to the trigger and `role="menu"` to the dropdown container correctly identifies the interactive relationship for assistive technologies without hardcoding an inaccurate `aria-expanded="false"` state.
**Action:** Always add `aria-haspopup="menu"` to the trigger button and `role="menu"` to the container for CSS-only hover dropdowns.
