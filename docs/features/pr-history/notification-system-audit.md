# Notification System Audit (MVP) — 2026-05-22

## Scope
Focused end-to-end audit of the implemented notification MVP surfaces:
- Bell host
- Notification history page
- Workflow notifications
- Due soon / overdue notifications
- Mark all as read
- Cleanup groundwork

No new notification types were added.

## Findings

### 1) Recipient scoping
- Recipient resolution remains firm-scoped in notification creation.
- Deleted users are excluded from recipient resolution paths.
- Direct assignee behavior remains intentional for due notifications (`assignedToXID` path is explicit).
- Workbasket fallback broadcast path is limited to active, non-deleted users.

### 2) Duplicate prevention
- Due-date notifications are deduped by firm + recipient + docket + type + `metadata.dueDateKey`.
- Workflow/event notifications keep grouping suppression via the existing 30-minute grouping window.

### 3) Background jobs
- Due notifications are scheduled with a safe minimum interval floor of 5 minutes, defaulting to hourly.
- Read-notification cleanup is not implicitly auto-scheduled in worker bootstrap (prevents accidental over-aggressive purge scheduling).
- Notification GET/list controller paths do not create notifications.

### 4) UI behavior
- Bell fetch is fail-soft/non-blocking.
- Unread badge condition remains tied to unread count > 0.
- Mark all as read action updates via API call.
- History view includes loading, error, and empty states.

### 5) Route/security
- Notification history route remains under protected firm routes.
- Mark-all-read and mark-single-read both operate with current user + firm scoping.

### 6) Docs
- `docs/whats-new.md` currently contains exactly one `# What's New` heading.

## Hardening added in this PR
- Added `tests/notificationSystemAudit.test.js` as a guardrail audit test to enforce the above invariants at source level.

## Validation run
- `node tests/notificationServiceMvpEvents.test.js`
- `node tests/docketWorkflowNotifications.test.js`
- `node tests/docketDueNotifications.test.js`
- `node tests/notificationMarkAllRead.test.js`
- `node tests/notificationCleanup.test.js`
- `node tests/notificationSystemAudit.test.js`
- `cd ui && node tests/notificationBellShell.test.mjs`
- `cd ui && node tests/notificationHistoryPagePolish.test.mjs`
- `cd ui && node tests/notificationHistoryActions.test.mjs`
- `cd ui && npm run build`

## Validation status update (2026-05-22)
- `node tests/notificationMarkAllRead.test.js` was re-run independently and passed.
- The intermittent DNS `EAI_AGAIN` issue was observed only during chained batch execution in this environment, not in the standalone `notificationMarkAllRead` run.
