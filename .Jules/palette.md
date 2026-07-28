## 2026-07-28 - Custom Mention Combobox Accessibility
**Learning:** Custom combobox/listbox components (like mention popovers) require full ARIA support (aria-expanded, aria-controls, aria-activedescendant, and aria-autocomplete) on the input field, paired with corresponding ids on the suggestion list and its individual options.
**Action:** Ensure custom combobox inputs are linked to their listbox and options using aria-controls and aria-activedescendant.
