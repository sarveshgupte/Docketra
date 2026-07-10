## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2026-07-10 - Added aria-hidden to decorative text icons
**Learning:** When using literal characters like '✓' or '✕' as text for icon-only buttons, they can be read improperly by screen readers.
**Action:** Always wrap these decorative text characters in a `<span aria-hidden="true">`, and ensure the parent button has a descriptive `aria-label` to provide an accessible name.
