## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2024-05-20 - [ARIA Context for Repeated Items]
**Learning:** Generic `aria-label`s on repeated list items (like "Mark as read" or "Clear" on notifications) lack necessary context. Providing an `aria-label` that is identical across multiple elements doesn't help screen reader users distinguish which specific item the button acts upon.
**Action:** Replace generic `aria-label`s on repeated action buttons by wrapping the visible icon/text in `<span aria-hidden="true">` and providing item-specific context using a visually hidden element like `<span className="sr-only">Mark notification "{item.title}" as read</span>`.
## 2024-08-06 - Missing ARIA combobox attributes on mention textarea
**Learning:** Custom textarea mention implementations effectively act as comboboxes. Without `aria-expanded`, `aria-controls`, and `aria-autocomplete`, screen reader users have no context that a popup list is available or what controls it.
**Action:** Always apply the combobox ARIA pattern (`aria-expanded`, `aria-controls`, `aria-autocomplete`) to text inputs that trigger popup suggestion lists, ensuring the listbox has a corresponding `id`.
## 2024-05-18 - Improve icon-only buttons with titles, add empty state, and focus indicators
**Learning:** Sighted mouse users lack context when icon-only buttons only use aria-labels. Also empty states are an opportunity to delight. Keyboard navigation needs focus-visible states on menu links.
**Action:** Add title tooltips alongside aria-labels for icon buttons. Always ensure empty states use positive, explanatory copy. Always apply focus-visible tailwind classes to interactive navigation elements.
