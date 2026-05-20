# Clients page platform migration

## Summary
- Migrated the Clients workspace surface to platform section primitives (`PageSection`, `SectionToolbar`, `FilterBar`, `StatusMessageStack`) so the page follows the same shell and section semantics as other workspaces.
- Kept the existing common `DataTable` intentionally because this page depends on server-driven pagination metadata (`page`, `pages`, `total`) and should preserve current page navigation behavior.
- Replaced inline styles in the Client Fact Sheet modal with scoped class-based styles in `ClientsPage.css`.
- Improved row action responsiveness with a wrapped action group for smaller widths while preserving all existing actions.

## Behavior verification checklist
- Search and query-param sync unchanged.
- Pagination controls and server-page behavior unchanged.
- Create/edit client modal flow unchanged, including sticky action row.
- Client Fact Sheet edit, attachment upload/delete unchanged.
- Bulk upload and create-docket actions unchanged.
