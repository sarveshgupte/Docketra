
## 2024-05-23 - Textarea Combobox ARIA Support
**Learning:** Custom mention/autocomplete popovers linked to standard `<textarea>` elements often fail screen reader evaluations because they lack the `role="combobox"` relationship. Screen readers need to know the input controls a list, whether the list is expanded, and which item is currently focused via keyboard arrows.
**Action:** Always implement `aria-autocomplete="list"`, `aria-expanded={isOpen}`, `aria-controls={listboxId}`, and `aria-activedescendant={activeOptionId}` on inputs/textareas that trigger floating autocomplete menus. Ensure the floating menu uses `role="listbox"` and its items use `role="option"`.
