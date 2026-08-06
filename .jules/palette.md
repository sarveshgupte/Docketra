## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2024-08-06 - Missing ARIA combobox attributes on mention textarea
**Learning:** Custom textarea mention implementations effectively act as comboboxes. Without `aria-expanded`, `aria-controls`, and `aria-autocomplete`, screen reader users have no context that a popup list is available or what controls it.
**Action:** Always apply the combobox ARIA pattern (`aria-expanded`, `aria-controls`, `aria-autocomplete`) to text inputs that trigger popup suggestion lists, ensuring the listbox has a corresponding `id`.
