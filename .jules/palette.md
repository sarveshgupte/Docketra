## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2026-06-06 - Enforce role enum values in UI dropdowns
**Learning:** React UI components like `CreateUserModal` must send system enum values (e.g. `USER`, `ADMIN`, `MANAGER`) instead of human-readable labels (e.g. `Employee`, `Admin`, `Manager`) to correctly map to the backend API contracts. Failing to do so breaks architecture/surface tests and validation logic.
**Action:** Changed the CreateUserModal role select options to map labels to their corresponding uppercase system enum values instead of passing the human-readable text.
