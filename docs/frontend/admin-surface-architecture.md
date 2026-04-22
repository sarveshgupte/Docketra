# Admin Surface Architecture

## 1) Page / component breakdown
- **`ui/src/pages/AdminPage.jsx`**
  - Owns tab-level orchestration (`users`, `categories`, `clients`).
  - Owns all admin API calls and mutation handlers.
  - Passes data + callbacks into focused UI components.
- **`ui/src/pages/admin/components/AdminUsersSection.jsx`**
  - Team members table, role/status rendering, and user action buttons.
- **`ui/src/pages/admin/components/CreateUserModal.jsx`**
  - Create-user form fields, role guidance, workbasket selection.
- **`ui/src/pages/admin/components/UserAccessModal.jsx`**
  - User workbasket/client assignment editor.
- **`ui/src/pages/admin/adminRoleCopy.js`**
  - Shared admin role/help copy used by create-user UX.

## 2) Hooks used and ownership
- `useState`
  - `AdminPage` owns page data and mutation state (`users`, `clients`, `workbaskets`, `creatingUser`, `savingUserAccess`, `actionLoadingByUser`, etc.).
- `useEffect`
  - Triggers tab-aware data loading and tab/query-param synchronization.
- `useMemo`
  - Derived lists/maps (`primaryWorkbaskets`, `qcOnlyWorkbaskets`, `workbasketNameById`, actor role flags).
- `useRef`
  - Toast deduplication lock/timer state.

## 3) Mutation flow + feedback rules
1. UI action calls a handler in `AdminPage`.
2. Handler sets local pending state (`creatingUser`, `savingUserAccess`, or `actionLoadingByUser[xID]`).
3. Handler executes `adminApi` mutation.
4. On success:
   - show toast,
   - update inline user-section message where applicable,
   - refresh admin data/stats.
5. On failure:
   - show error toast,
   - keep user on page with current context.

## 4) Loading / error state rules
- **Page load**: `loading` shows table skeleton.
- **Tab load failures**: normalized via `notifyLoadError`; clients tab can show retryable empty/error state.
- **Per-action loading**: user row buttons disable while that user action is in flight.
- **Form submit safety**: create-user submit returns early when already creating.

## 5) Admin UX rules for sensitive actions
- Require confirmation before:
  - activate/deactivate/cancel invite,
  - unlock account,
  - send password reset.
- Never allow deactivation of primary admin user.
- Keep role copy explicit:
  - firm hierarchy: `Primary Admin > Admin > Manager > User`,
  - `SuperAdmin` is platform-only.
