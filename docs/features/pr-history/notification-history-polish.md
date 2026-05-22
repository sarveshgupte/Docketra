# Notification History polish (2026-05-22)

## Summary
- Migrated Notification History to PlatformShell and workspace page primitives.
- Removed legacy layout wrapper usage and inline styles.
- Added scoped notification-history CSS classes for readability and state clarity.
- Preserved notification loading, pagination, mark-as-read, and docket navigation behavior.

## UX and accessibility notes
- Unread notifications are visually distinct.
- Mark-as-read only appears for unread items.
- Notification metadata is grouped and scannable.
- Semantic list markup remains in place with keyboard-accessible actions.
