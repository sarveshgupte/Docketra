## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2024-06-19 - [Audio UX for Emoji Icons]
**Learning:** Found cases where raw emojis were used as icons within buttons (e.g., `🗑️` for delete). Screen readers read these out literally (e.g., "Wastebasket"), which creates audio noise.
**Action:** To improve audio UX when using emojis as icon-only buttons, wrap the raw emoji in a `<span aria-hidden="true">` element and apply a descriptive `aria-label` to the parent `<button>`.
