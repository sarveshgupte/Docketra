## 2024-10-30 - Accessible CSS-Only Dropdowns
**Learning:** CSS-only hover dropdowns in Tailwind using `group-hover` become completely inaccessible via keyboard navigation if internal links are focused but the container doesn't use `group-focus-within`.
**Action:** Next time, always apply `focus-within` utilities (e.g., `group-focus-within:opacity-100 group-focus-within:visible`) alongside `group-hover` classes on dropdown containers, and ensure the trigger button has `aria-haspopup="true"`.
