## 2024-05-30 - Fix keyboard accessibility for CSS hover menus
**Learning:** Pure CSS hover dropdowns using `group-hover` in Tailwind are completely inaccessible to keyboard users because the hover state does not trigger on focus.
**Action:** When implementing CSS dropdowns, ALWAYS pair `group-hover:*` classes with `group-focus-within:*` classes on the container so the dropdown stays visible while child elements have focus. Also ensure the trigger button has `aria-expanded` and `aria-haspopup`.
