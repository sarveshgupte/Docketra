# Admin Surface Architecture

## Purpose
Keep `AdminPage` as a route-level orchestrator while moving section rendering and data loading into stable, focused modules.

## Current structure

### Route orchestrator
- **`ui/src/pages/AdminPage.jsx`**
  - Owns route/query-param behavior and tab selection.
  - Owns mutation handlers and permission-gated actions.
  - Delegates section rendering and modal rendering to dedicated admin modules.

### Shared admin data hook
- **`ui/src/pages/admin/hooks/useAdminDataLoader.js`**
  - Shared fetch layer for `loadAdminStats`, `loadAdminData`, `fetchClients`, `fetchWorkbaskets`.
  - Centralizes loading/error state normalization for tab-aware data loading.

### Section modules
- **`ui/src/pages/admin/components/AdminUsersSection.jsx`** → team/users + user security actions.
- **`ui/src/pages/admin/components/AdminClientsSection.jsx`** → client list, client-state empty/error/retry path, client entry points.
- **`ui/src/pages/admin/components/AdminCategoriesSection.jsx`** → categories/subcategories + workbasket mapping view.

### Modal modules
- **`CreateUserModal.jsx`** → user creation.
- **`UserAccessModal.jsx`** → user client/workbasket assignment.
- **`AdminBulkPasteModal.jsx`** → bulk paste UX for categories/subcategories/clients.
- **`AdminCategoryModals.jsx`** → create category + add subcategory modals.
- **`AdminClientModals.jsx`** → create/edit client and legal-name change modals.

## Permission boundaries
- Frontend permission checks remain in `AdminPage` handlers and are unchanged (`PRIMARY_ADMIN` gating where required).
- Section components are presentational/action-triggering only.
- Backend remains authorization source of truth.

## Where future admin features should go
Use the following placement rules:

1. **Team / users / hierarchy actions**
   - Add section UI under `AdminUsersSection`.
   - Add data-fetch helpers to `useAdminDataLoader` only if shared by multiple user actions/tabs.
   - Keep sensitive mutation orchestration and permission gates in `AdminPage` handlers.

2. **Roles / permissions**
   - Add dedicated component under `ui/src/pages/admin/components/` (for example `AdminRolesSection.jsx`).
   - Reuse existing confirmation + toast patterns from `AdminPage`.

3. **Clients**
   - Add list/table changes in `AdminClientsSection`.
   - Add client-create/edit flows in `AdminClientModals`.

4. **Categories / subcategories / workbench mapping**
   - Keep list and mapping display changes in `AdminCategoriesSection`.
   - Keep category/subcategory forms in `AdminCategoryModals`.

5. **Storage / settings / firm profile**
   - Add new dedicated section components next to other `admin/components/*Section.jsx` files.
   - Keep route-level tab state and permission gates in `AdminPage`.

## Regression coverage
- `ui/tests/adminSurfaceHardening.test.mjs`
- `ui/tests/adminArchitectureSmoke.test.mjs`

These tests enforce modular boundaries and help prevent `AdminPage` from regressing into one monolithic render surface.
