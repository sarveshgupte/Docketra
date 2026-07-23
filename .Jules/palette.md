## 2024-07-23 - Textarea Autocomplete Accessibility
**Learning:** Custom combobox/listbox components (like autocomplete popovers for mentions) must explicitly tie input fields to suggestion lists using `aria-expanded`, `aria-controls`, `aria-activedescendant`, and `aria-autocomplete`.
**Action:** Always add full combobox ARIA attributes mapping inputs to their respective suggestion lists and individual options by id.
