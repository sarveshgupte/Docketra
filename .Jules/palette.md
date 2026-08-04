## 2024-08-04 - Dynamic ARIA attributes for Listbox Options
**Learning:** When creating a custom combobox/listbox components (like autocomplete or mention popovers), full ARIA support is required by using aria-expanded, aria-controls, aria-activedescendant, and aria-autocomplete on the input field, paired with corresponding ids on the suggestion list and its individual options to ensure screen readers correctly announce focus changes during keyboard navigation.
**Action:** When creating or maintaining such components, ensure these ARIA attributes and IDs are dynamically connected.
