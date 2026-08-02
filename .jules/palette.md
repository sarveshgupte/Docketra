## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2026-08-02 - [Add missing aria-controls to aria-expanded toggles]
**Learning:** Missing aria-controls on buttons using aria-expanded (e.g., StorageStatusBadge, Layout sidebar toggle) prevents screen readers from understanding which element the toggle operates on. Even though aria-expanded tells them the state changed, they don't know what it changed.
**Action:** Always pair aria-expanded with an aria-controls attribute pointing to the ID of the controlled content panel.
