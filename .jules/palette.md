## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2024-05-20 - [Emojis/literal icon characters as icon-only buttons]
**Learning:** Screen readers read literal characters like "✕" or "✓" when they're inside a button, even if the button has an `aria-label`.
**Action:** To improve accessibility when using emojis or literal icon characters (e.g., ✓, ✕, ×) as icon-only buttons, wrap the raw character in a `<span aria-hidden="true">` element to prevent screen readers from reading the literal symbol name, and apply a descriptive `aria-label` to the parent `<button>`.
