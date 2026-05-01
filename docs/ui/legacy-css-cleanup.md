# Legacy CSS Cleanup Audit (Final modernization cleanup pass)

Date: April 28, 2026  
Scope: conservative, presentation-only cleanup for stale/legacy UI styling.

## Audit method

Search patterns used:
- `neo-`
- `glass`
- hardcoded color utilities (`gray-*`, `slate-*`, `blue-*`, `red-*`, `amber-*`, `emerald-*`)
- raw hex colors in product-app style files
- `focus-visible` definitions for consistency checks

## Legacy compatibility stylesheet status

### `ui/src/assets/styles/neomorphic.css`
- **Status:** retained.
- **Role:** deprecated compatibility bridge for legacy `neo-*` class families still present in live UI routes/components.
- **Why retained now:** active `neo-*` class usage still exists; removing the bridge in this PR would add migration risk.
- **Deprecation rule:** do not add new `neo-*` usage. Migrate route-by-route to shared tokenized primitives, then remove the file in a dedicated migration/removal PR.

## Active `neo-*` inventory (current)

### Class families still used
- `neo-alert*` (auth + case-detail alerts)
- `neo-button*` (reports actions)
- `neo-input` (legacy workspace filters)
- `neo-table` (reports + docket list/table surfaces)
- `neo-info-text`, `neo-form-actions` (bulk upload flows)
- `neo-dropzone*` (client document upload surface)
- `neo-spinner` (loading indicator)
- `neo-page__title` (legacy workspace heading)

### Example active files
- `ui/src/pages/ForgotPasswordPage.jsx`
- `ui/src/pages/ChangePasswordPage.jsx`
- `ui/src/pages/ResetPasswordPage.jsx`
- `ui/src/pages/caseDetail/CaseDetailAlerts.jsx`
- `ui/src/pages/reports/ReportsDashboard.jsx`
- `ui/src/components/reports/ReportsTable.jsx`
- `ui/src/pages/ClientsPage.jsx`
- `ui/src/components/bulk/BulkUploadModal.jsx`
- `ui/src/components/bulk/DocketBulkUploadModal.jsx`
- `ui/src/components/feedback/LoadingSpinner.jsx`

## Tokenized cleanup completed in this pass

1. `ui/src/assets/styles/neomorphic.css`
   - Restored and retained as deprecated compatibility CSS.
   - Token-aligned low-risk color/border/focus values to `--dt-*` equivalents.

2. `ui/src/pages/AdminPage.css`
   - Replaced low-risk hardcoded and legacy fallback color variables with `--dt-*` tokens.
   - Kept spacing/layout/density unchanged.

3. `ui/src/pages/ComplianceCalendarPage.css`
   - Replaced low-risk hardcoded colors with `--dt-*` tokens.
   - Added explicit tokenized form text/background and focus-visible styling.

4. `ui/src/components/common/Layout.css`
   - Tokenized legacy hardcoded notification-dot color to semantic `--dt-error`.

## Migration path (for later dedicated PR)

1. Migrate active `neo-*` class usage route-by-route to shared primitives (`Button`, `Input`, status notices, modern table contracts).
2. Move cross-module helper selectors currently anchored in `AdminPage.css` into a dedicated scoped legacy-bridge stylesheet if needed.
3. After zero active `neo-*` usage is confirmed by search + visual QA, remove `neomorphic.css` in a dedicated cleanup PR.
