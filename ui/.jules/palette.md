## 2024-05-19 - Accessibility of Search Inputs
**Learning:** Generic inputs lacking `id` or explicit `<label>` elements were found relying solely on `placeholder` attributes (e.g. `placeholder="Filter by action"`). Placeholders alone are insufficient for screen readers.
**Action:** When creating text or datetime inputs without visible `<label>` components, always apply a descriptive `aria-label` attribute and ensure `<button>` elements define `type="button"`.
