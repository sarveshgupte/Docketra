## 2024-04-08 - Mobile Menu Accessibility & Interaction Polish
**Learning:** Adding dynamic `aria-label`, `aria-expanded`, and `aria-controls` to mobile hamburger menus significantly improves the screen reader experience, especially when paired with visual icon toggles (`☰` vs `✕`) and keyboard focus states.
**Action:** Always include complete ARIA states (`expanded`, `controls`) and clear hover/focus styling for custom toggle buttons across the platform.

## 2024-04-11 - Dynamic Sort Header Accessibility
**Learning:** Icon-only states indicating complex toggle behaviors (like sorting directions) can lack context for screen readers if only aria-hidden characters are used.
**Action:** When implementing tri-state toggle buttons, provide dynamic `aria-label`s and tooltips that explicitly describe the *next* action the click will perform.
