## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2026-06-27 - [Consistent ARIA Controls for All Disclosures]
**Learning:** Verified the previously discovered pattern. More components like the mobile sidebar toggle (`Layout.jsx`) and `StorageStatusBadge.jsx` had `aria-expanded` attributes without corresponding `aria-controls` bindings pointing to a target `id`.
**Action:** Before creating new UI components or modifying existing ones with expandable states (like popovers, sidebars, or menus), rigorously check that `aria-expanded` is ALWAYS paired with `aria-controls` and that the target element has a matching `id`.
