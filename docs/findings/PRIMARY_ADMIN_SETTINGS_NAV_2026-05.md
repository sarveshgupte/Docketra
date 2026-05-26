# PRIMARY_ADMIN settings navigation (May 2026)

## Symptom
- Logged-in firm users with `PRIMARY_ADMIN` role did not consistently see an obvious Settings/Admin section in the sidebar.
- This blocked fast access to core admin pages in firm workspace.

## Root cause
1. **Sparse Administration navigation model**
   - Sidebar `Administration` section only had a single generic `Settings` entry, with no explicit links for common operational admin destinations (team management, workbasket/category setup, storage, data map).
2. **Role normalization fragility**
   - Sidebar role checks normalized only with `toUpperCase()`, but did not normalize whitespace/hyphen variants from backend profile shape (`primary-admin`, `primary admin`, etc.).
   - This could degrade `minRole` checks and hide admin navigation unexpectedly.

## Fix
- Expanded `Administration` section in `ui/src/constants/platformNavigation.js` with explicit admin links:
  - Workspace Settings
  - Users & Team
  - Workbasket Settings
  - Category Settings
  - Storage Settings
  - Data Storage Map
  - Client Encryption / Security
- Kept strict gate `minRole: 'ADMIN'` on every admin/settings entry.
- Hardened role normalization in navigation helpers to be case- and separator-safe:
  - `trim().toUpperCase().replace(/[\s-]+/g, '_')`
- Verified storage popover links remain canonical and aligned with registered routes via shared route constants (`ROUTES.STORAGE_SETTINGS`, `ROUTES.DATA_STORAGE_MAP`).

## Tests added
- `tests/primaryAdminSettingsNavigation.ui.static.test.js`
  - Verifies Administration section exists and is admin-gated.
  - Verifies role-rank hierarchy supports `PRIMARY_ADMIN` and `ADMIN`, and excludes `USER`.
  - Verifies safe role normalization expression exists.
  - Verifies admin/settings link targets are registered in `ProtectedRoutes`.
  - Verifies Storage Settings/Data Storage Map popover links use canonical route targets.

## Manual verification checklist
1. Log in as `PRIMARY_ADMIN` in a firm workspace.
2. Confirm sidebar shows **Administration** section with:
   - Workspace Settings
   - Users & Team
   - Workbasket Settings
   - Category Settings
   - Storage Settings
   - Data Storage Map
   - Client Encryption / Security
3. Click each visible admin link; confirm route loads and no 404.
4. Open storage status popover; click **Storage Settings** and **Data Storage Map**; confirm both routes load.
5. Log in as `ADMIN`; confirm same Administration section appears.
6. Log in as `USER`; confirm Administration section is hidden and direct admin route access is blocked by route guard.

