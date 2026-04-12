🎨 Palette: [UX improvement] Phase 1 UI/UX Maturity updates

💡 What
- Consolidated the `DataTable` component to remove duplication (`components/layout/DataTable` -> `components/common/DataTable`).
- Refined the `Button` component to support the `sm` size, aligning with enterprise spacing tokens.
- Replaced custom `<Table>` blocks with the unified `<DataTable>` component across `AdminPage`, `DashboardPage`, `WorkbasketPage`, `CasesPage`, and `ClientsPage`.
- Updated action feedback mechanisms across mutating handlers (`CaseDetailPage`, `WorkbasketPage`) to trigger toasts with deterministic success and error states.
- Standardized the usage of timestamps across files using `formatDateTime()` and removed raw `new Date()` renderings.

🎯 Why
- Addresses the UX concerns outlined in `phase1-uiux-maturity-sprint.md` regarding inconsistent list views and ambiguous action feedback.
- Makes lists and dashboard views behave more consistently across the enterprise platform.
- Eliminates technical debt related to duplicated table logic.

📸 Before/After
- Before: Custom rendering logic and different table components existed across `AdminPage` and `CasesPage`.
- After: Standard `<DataTable>` usage is consistent, featuring integrated filter and sorting functionality. Modals and action handlers use robust `showSuccess` toast notifications.

♿ Accessibility
- Ensured table filters and headers are appropriately semantic and accessible via the unified `<DataTable>`.
