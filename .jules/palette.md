## 2024-04-08 - Mobile Menu Accessibility & Interaction Polish
**Learning:** Adding dynamic `aria-label`, `aria-expanded`, and `aria-controls` to mobile hamburger menus significantly improves the screen reader experience, especially when paired with visual icon toggles (`☰` vs `✕`) and keyboard focus states.
**Action:** Always include complete ARIA states (`expanded`, `controls`) and clear hover/focus styling for custom toggle buttons across the platform.

## 2024-04-11 - Dynamic Sort Header Accessibility
**Learning:** Icon-only states indicating complex toggle behaviors (like sorting directions) can lack context for screen readers if only aria-hidden characters are used.
**Action:** When implementing tri-state toggle buttons, provide dynamic `aria-label`s and tooltips that explicitly describe the *next* action the click will perform.

## 2024-04-14 - DataTable Filter Chip Accessibility
**Learning:** Adding `aria-label`s to filter removal buttons is crucial for screen readers, but the label must include *both* the filter key and its active value. Overriding the content with just the action and the key (e.g., `aria-label="Remove filter: Status"`) causes visually impaired users to lose the context of what value they are actually removing (e.g., "Active").
**Action:** When adding `aria-label`s to action buttons that represent data states, always interpolate both the label and the value into the accessible description (e.g., `aria-label={\`Remove filter: \${f.label} \${f.value}\`}`).
