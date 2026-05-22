# PR History — Workspace notification bell shell host

Date: 2026-05-21

## Summary

This change adds a notification bell entry point to the firm workspace `PlatformShell` topbar so users have a persistent way to access notification history.

## What changed

- Added `NotificationBell` component at `ui/src/components/platform/NotificationBell.jsx`.
- Mounted the bell in the right-side `PlatformShell` action rail near existing account/menu actions.
- Bell fetches notifications with `notificationsApi.getAllNotifications()` and normalizes common response shapes:
  - array
  - `response.data` array
  - `response.data.data` array
- Unread count logic uses `read === false` OR `isRead === false`.
- Added count badge behavior:
  - hidden at zero
  - exact value through 99
  - `99+` when unread exceeds 99
- Added count-aware accessible label:
  - `Notifications` when zero unread
  - `Notifications, N unread` when unread exists
- Added route alias consistency by introducing `ROUTES.NOTIFICATIONS(firmSlug)` and retaining `NOTIFICATIONS_HISTORY` as a legacy alias.
- Added shell-focused regression test at `ui/tests/notificationBellShell.test.mjs`.

## Non-goals kept intact

- No notification popups/toasts were implemented.
- No notification type/rule decisions were introduced.
- Notification fetch failures are silent/non-blocking and do not break shell rendering.
