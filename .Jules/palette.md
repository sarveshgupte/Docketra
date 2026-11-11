## 2024-11-09 - Accessible CSS-only Hover Dropdowns
**Learning:** Pure CSS `group-hover` dropdowns are inaccessible to keyboard users unless explicitly handled.
**Action:** When making CSS-only hover dropdowns accessible via keyboard, apply `group-focus-within` utilities (like `group-focus-within:opacity-100 group-focus-within:visible`) alongside `group-hover` classes on the parent container. Ensure the trigger button includes `aria-haspopup="true"` and visible focus indicators.
## 2024-11-11 - Accessible Focus Rings on Inline Custom Outlines
**Learning:** Hardcoding `outline: 'none'` in inline styles (often conditionally for custom focus states) completely disables the browser's native focus ring, causing severe accessibility issues for keyboard users if a fallback isn't provided.
**Action:** When a component uses custom focus logic (e.g., `outline: focused ? '...' : 'none'`), replace `'none'` with `undefined` to allow the element to fall back to standard CSS-driven `:focus-visible` styles when not programmatically focused, and ensure `focus-visible` utility classes are present on the element.
