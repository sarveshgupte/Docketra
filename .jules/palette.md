## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2024-07-03 - [ARIA State for Sidebar Toggles]
**Learning:** Found that the main sidebar toggle button (`.enterprise-sidebar__footer-toggle`) within `ui/src/components/common/Layout.jsx` lacked `aria-expanded` and `aria-controls` bindings. While its label changes between "Expand" and "Collapse", this alone does not programmatically associate the control with the region it modifies for screen readers.
**Action:** When implementing disclosure patterns or collapsible sidebars, always pair `aria-expanded` with `aria-controls` explicitly pointing to the ID of the expanded `<nav>` or content block.
