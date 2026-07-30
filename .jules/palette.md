## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2024-05-20 - Icon-only buttons with emojis
**Learning:** Using literal characters (e.g., ✓, ✕, ×) inside `<button>` elements with `aria-label` causes screen readers to read both the `aria-label` and the literal character, leading to confusing announcements.
**Action:** Always wrap raw characters or emojis in `<span aria-hidden="true">` when used inside icon-only buttons to prevent them from being read aloud.
