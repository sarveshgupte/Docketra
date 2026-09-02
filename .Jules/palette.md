## 2024-08-07 - Add tooltips to icon-only buttons
**Learning:** Found several icon-only buttons without `aria-label` attributes or explicit tooltip titles, which creates accessibility barriers and confusing user experience. Specifically, `ui/src/components/common/FirmSwitcher.jsx` has a close button with just `×`, `ui/src/components/common/AuditTimelineDrawer.jsx` has a close button with just `×`, and `ui/src/components/common/Layout.jsx` has check/cross buttons without tooltips. These are straightforward UX wins.
**Action:** Adding `aria-label` attributes (and occasionally `title`) to icon-only buttons is a crucial micro-UX improvement to enhance accessibility and provide helpful context to users.
## 2024-08-12 - Icon-only Button Tooltips
**Learning:** When improving usability of icon-only buttons that already contain `aria-label` attributes, add native HTML `title` attributes to provide explicit hover tooltips for sighted mouse users.
**Action:** Always pair `aria-label` with `title` on icon-only buttons.
## 2026-08-13 - BubbleMenu Dropdown Accessibility
**Learning:** Dropdowns and toggles with `aria-expanded` need a linked `aria-controls` pointing to a unique element ID to correctly announce state to screen readers. If there are multiple instances on a page, hardcoded IDs will conflict.
**Action:** Use React's `useId()` to generate unique IDs for dropdown menus and bind them to the toggle button's `aria-controls`.
## 2024-09-02 - Textarea Mention Popover Accessibility
**Learning:** When dealing with dynamic popovers or listboxes like mention suggestions in a `<textarea>`, duplicated IDs (`id={suggestionsListId}` and `id={listboxId}`) on the wrapper `div`, and disconnected `aria-controls` bindings (pointing to `listboxId` while using `suggestionsListId` elsewhere) break screen reader tracking and violate ARIA combobox specs. Additionally, duplicated `aria-*` attributes on elements (like `aria-expanded` and `aria-autocomplete`) create invalid HTML and unpredictable behavior across different assistive technologies.
**Action:** Ensure combobox inputs use a single, consistent ID for their controlled popover (`aria-controls={uniqueId}`), and strictly avoid passing duplicated props to React DOM elements.
