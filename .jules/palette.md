## 2024-05-18 - Literal Icon Characters Need aria-hidden

**Learning:** Buttons that use raw Unicode text characters for icons (e.g., `✓`, `✕`, `×`) will have those literal characters read aloud by screen readers (like "check mark" or "multiplication X"), even if the button itself has an `aria-label`. This creates a confusing and redundant auditory experience (e.g., "Close button, multiplication X").
**Action:** When using literal characters as icons, always wrap them in a `<span aria-hidden="true">` to silence them for screen readers while ensuring the parent button has an appropriate `aria-label`.
