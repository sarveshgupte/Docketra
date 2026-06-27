## 2024-05-20 - [ARIA state for Expandable Menus]
**Learning:** Found multiple components across the codebase lacking `aria-controls` bindings to pair with `aria-expanded` (e.g. `FirmSwitcher`). While `aria-expanded` tells screen readers the state, `aria-controls` is critical for associating the trigger button directly with the ID of the expanded content block.
**Action:** Always ensure disclosure buttons/dropdown triggers have an explicit `aria-controls="[dropdown-id]"` attribute connected to the `id` of their respective content panels when implementing custom drop-downs.

## 2024-05-24 - Playwright Focus Testing
**Learning:** Testing CSS focus rings on full React pages via Playwright can be flaky due to navigation and rendering times.
**Action:** For simple CSS focus verification, it's faster and more reliable to use `page.evaluate` to inject the relevant DOM structure and styles directly into the browser and then simulate tab presses.
