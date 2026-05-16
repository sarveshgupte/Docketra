## 2024-04-08 - Mobile Menu Accessibility & Interaction Polish
**Learning:** Adding dynamic `aria-label`, `aria-expanded`, and `aria-controls` to mobile hamburger menus significantly improves the screen reader experience, especially when paired with visual icon toggles (`☰` vs `✕`) and keyboard focus states.
**Action:** Always include complete ARIA states (`expanded`, `controls`) and clear hover/focus styling for custom toggle buttons across the platform.

## 2024-04-11 - Dynamic Sort Header Accessibility
**Learning:** Icon-only states indicating complex toggle behaviors (like sorting directions) can lack context for screen readers if only aria-hidden characters are used.
**Action:** When implementing tri-state toggle buttons, provide dynamic `aria-label`s and tooltips that explicitly describe the *next* action the click will perform.

## 2024-04-14 - DataTable Filter Chip Accessibility
**Learning:** Adding `aria-label`s to filter removal buttons is crucial for screen readers, but the label must include *both* the filter key and its active value. Overriding the content with just the action and the key (e.g., `aria-label="Remove filter: Status"`) causes visually impaired users to lose the context of what value they are actually removing (e.g., "Active").
**Action:** When adding `aria-label`s to action buttons that represent data states, always interpolate both the label and the value into the accessible description (e.g., `aria-label={\`Remove filter: \${f.label} \${f.value}\`}`).

## 2024-04-16 - Dynamic Aria-Labels for Repeated Action Buttons
**Learning:** When rendering lists of items where each item has an identical, generic action button (e.g., 'Open', 'View'), screen reader users lose context as to which item they are interacting with. Also, adjacent decorative emojis can create unwanted audio clutter if not explicitly hidden.
**Action:** Always inject specific item identifiers (like `fileName`) into the action button's `aria-label` (e.g., `aria-label={\`Open document \${file.fileName}\`}`), and ensure nearby decorative icons have `aria-hidden="true"`.

## 2025-04-17 - Added `aria-pressed` to Password Visibility Toggle
**Learning:** Found an accessibility issue where the password visibility toggle button was using an `aria-label` to communicate state (e.g., "Show password" vs. "Hide password"), but lacked the crucial `aria-pressed` attribute which is standard for toggle buttons. Without `aria-pressed`, screen readers don't explicitly treat it as a stateful toggle, leaving the user guessing if the action was correctly registered.
**Action:** When implementing icon-only toggle buttons (like password visibility, or "favorite" toggles), ensure that they not only have descriptive, dynamic `aria-label`s, but also include an explicit `aria-pressed={state}` attribute to robustly communicate their toggle nature to assistive technologies.
## 2025-04-29 - Dynamic Action Buttons
**Learning:** When rendering lists of items with generic action buttons (e.g., 'Open', 'View') that have dynamic inner text states, applying `aria-label` directly to the container overrides the visible text for screen readers. This breaks the connection between visual content and screen reader output.
**Action:** Avoid applying `aria-label` to containers with visible text. Instead, wrap the generic visible text in `<span aria-hidden="true">` and append a `<span className="sr-only">` containing both the action and the specific item identifier.
## 2026-04-19 - SuperAdmin Layout Accessibility improvements
**Learning:** The SuperAdminLayout component had missing landmark roles, active states for screen readers, and focus indicators for interactive elements.
**Action:** Add `aria-label` attributes to `<aside>` and `<nav>` elements, add `aria-label` and `focus-visible` classes to logout buttons, and use `aria-current="page"` on active navigation links across the platform.

## 2026-05-09 - Clipboard Action Feedback
**Learning:** Clipboard-driven actions need temporary, visible confirmation so users can tell whether a copy action actually completed.
**Action:** For clipboard copy UI, provide short-lived status feedback (e.g., success text) and keep the feedback region under `aria-live="polite"` so assistive technologies announce dynamic updates.

## 2026-05-09 - Clipboard Failure Feedback & Timeout Hygiene
**Learning:** Clipboard APIs can be unavailable in some contexts and write operations can reject, which makes optimistic success messaging misleading and inaccessible.
**Action:** Await clipboard writes before showing success, expose an explicit failure state when unavailable/rejected, and manage feedback timers with refs that are cleared before restart and cleaned up on unmount.
## 2026-05-13 - Explicit button types and focus states
**Learning:** Generic buttons rendered in specialized components like `ErrorBoundary` can easily lack explicit `type="button"` attributes and keyboard focus styles, leading to potential a11y issues and unintended form submissions if they are caught wrapping complex views.
**Action:** Always verify that interactive buttons include explicit `type="button"` attributes and visual focus indicators (e.g., Tailwind's `focus-visible` classes) to ensure keyboard accessibility and prevent unintended form submissions.

## 2026-05-13 - Dynamic ARIA Labels for Badge Counts
**Learning:** When displaying notification or message counts inside badges (e.g., a red dot with "3"), hiding the badge with `aria-hidden="true"` prevents visual redundancy for sighted screen reader users, but completely hides the unread status from purely visually impaired users.
**Action:** When a button contains a visually hidden unread count or badge, always interpolate that count into the parent button's `aria-label` (e.g., `aria-label={count > 0 ? \`Notifications (\${count} unread)\` : 'Notifications'}`).
## 2026-05-18 - Clipboard Feedback Extensibility
**Learning:** Adding clipboard feedback (success/error states) to icon-only buttons improves UX, especially when `aria-live="polite"` is used.
**Action:** When implementing copy-to-clipboard functionality, explicitly manage timeout cleanup to prevent memory leaks and handle cases where `navigator.clipboard.writeText` fails or is unavailable.
