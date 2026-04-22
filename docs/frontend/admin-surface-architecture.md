# Admin Surface Architecture

## 0) Admin polish fixes delivered
- Standardized admin-facing role wording to `Primary Admin`, `Admin`, `Manager`, `Employee`, `Partner`.
- Removed mixed `Employee (User)` copy in shared admin role help copy.
- Replaced native confirm dialogs for high-risk user actions with shared modal UX.
- Kept `AdminPage` as orchestrator while preserving existing split into focused renderer components.

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
- Confirmation orchestration
  - `pendingConfirmation` state in `AdminPage` drives a shared `ActionConfirmModal` for sensitive actions.

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
- Use app-consistent modal UX (`ActionConfirmModal`) instead of `window.confirm`.
- Confirmation modal disables close/secondary actions while the confirm mutation is in-flight.
- Never allow deactivation of primary admin user.
- Keep role copy explicit:
  - firm hierarchy: `Primary Admin > Admin > Manager > Employee`,
  - `SuperAdmin` is platform-only.
  - internal stored role may remain `USER`; admin-facing label is `Employee`.

## 6) Safety and authorization alignment
- `AdminPage` is orchestrator-only: heavy rendering and table actions remain in `AdminUsersSection` / modal components.
- Backend is the source of truth for authorization; frontend role checks are UX guards only.
- Admin action feedback follows a predictable pattern:
  1. set per-user loading,
  2. execute API mutation,
  3. show toast + section message,
  4. refresh users/stats and close confirmation modal on success.

## 7) Most important regressions tied to this surface
- `ui/tests/adminSurfaceHardening.test.mjs`
  - validates `ActionConfirmModal` usage for high-risk user actions,
  - asserts native `window.confirm` is not used for these actions,
  - asserts canonical role hierarchy copy (`... > Employee`) is present.
