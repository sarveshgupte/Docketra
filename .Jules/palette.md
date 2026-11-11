## 2024-11-09 - Accessible CSS-only Hover Dropdowns
**Learning:** Pure CSS `group-hover` dropdowns are inaccessible to keyboard users unless explicitly handled.
**Action:** When making CSS-only hover dropdowns accessible via keyboard, apply `group-focus-within` utilities (like `group-focus-within:opacity-100 group-focus-within:visible`) alongside `group-hover` classes on the parent container. Ensure the trigger button includes `aria-haspopup="true"` and visible focus indicators.
