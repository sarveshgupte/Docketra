## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2026-06-20 - [Item-specific ARIA context in iterative lists]
**Learning:** Found iterative list buttons (like notifications) using generic `aria-label` attributes (e.g., "Mark as read"). This lacks context for screen-reader users, who won't know which specific list item the action applies to.
**Action:** When creating buttons within loops or iterative lists, wrap the visible content in an `<span aria-hidden="true">`, and provide a visually hidden `<span className="sr-only">` that includes the generic action and the specific item's context (e.g. `Mark as read: ${item.title}`). Always truncate dynamic text (e.g., to 80 chars) to prevent overly verbose announcements.
