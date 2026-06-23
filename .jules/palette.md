## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2024-05-20 - [ARIA Context for Repeated Items]
**Learning:** Generic `aria-label`s on repeated list items (like "Mark as read" or "Clear" on notifications) lack necessary context. Providing an `aria-label` that is identical across multiple elements doesn't help screen reader users distinguish which specific item the button acts upon.
**Action:** Replace generic `aria-label`s on repeated action buttons by wrapping the visible icon/text in `<span aria-hidden="true">` and providing item-specific context using a visually hidden element like `<span className="sr-only">Mark notification "{item.title}" as read</span>`.
