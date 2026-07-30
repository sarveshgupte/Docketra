1. **Fix `<button>` in `FirmSwitcher.jsx`**
   - Add `type="button"` to `<button>` tags in `ui/src/components/common/FirmSwitcher.jsx` to prevent unintentional form submissions if used within forms.
2. **Fix `<button>` in `ReportsTable.jsx`**
   - Add `type="button"` to `<button>` tags in `ui/src/components/reports/ReportsTable.jsx` to ensure proper button type.
3. **Verify**
   - Run UI tests.
4. **Pre-commit and Submit**
   - Run pre-commit checks.
