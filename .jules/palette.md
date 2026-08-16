## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2024-05-18 - Improve icon-only buttons with titles, add empty state, and focus indicators
**Learning:** Sighted mouse users lack context when icon-only buttons only use aria-labels. Also empty states are an opportunity to delight. Keyboard navigation needs focus-visible states on menu links.
**Action:** Add title tooltips alongside aria-labels for icon buttons. Always ensure empty states use positive, explanatory copy. Always apply focus-visible tailwind classes to interactive navigation elements.
