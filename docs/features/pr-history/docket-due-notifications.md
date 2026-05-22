# Docket due-date notifications

This PR adds backend, job-driven due-date notifications for active dockets.

## Added notification events
- `DOCKET_DUE_SOON`
- `DOCKET_OVERDUE`

## Behavior
- Uses a 24-hour due-soon window (`DUE_SOON_WINDOW_HOURS`, env-overridable).
- Scans active dockets with due dates.
- Skips terminal dockets (`RESOLVED`, `FILED`, `CANCELLED`, `TERMINATED`, `CLOSED`, `ARCHIVED`).
- Sends to direct assignee (`assignedToXID`) when present.
- Falls back to active workbasket members for unassigned dockets with workbasket ownership.
- Prevents duplicates per `docket + recipient + type + dueDateKey`.
- Stores `dueDate` and `dueDateKey` in notification metadata.
- Handles notification write failures non-fatally.

## Scheduling
- Wired into background schedule bootstrap via `processDocketDueNotifications()`.
- Interval defaults to hourly and can be configured with `DOCKET_DUE_NOTIFICATION_INTERVAL_MS`.
