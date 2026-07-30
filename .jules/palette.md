## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.
## 2024-06-28 - [ARIA Controls on Expanding Content]
**Learning:** Multiple key structural elements like the enterprise sidebar and storage popover lacked `id` attributes and were not connected to their toggle triggers via `aria-controls`. While `aria-expanded` is present on toggles, omitting `aria-controls` breaks the semantic relationship for screen reader users trying to navigate to the opened content.
**Action:** Always map toggle buttons (using `aria-expanded`) to their corresponding content panels by adding a unique `id` to the panel and referencing it with `aria-controls` on the button.
