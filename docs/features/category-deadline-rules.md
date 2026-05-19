# Category/Subcategory Deadline Rules

This feature adds configurable subcategory-level deadline defaults in Category Management.

- Rules are stored under `subcategory.deadlineRule` (not at category level).
- Rule modes: `NONE`, `TAT_DAYS`, `FIXED_DAY_NEXT_MONTH`, `MANUAL_DATE_REQUIRED`, `EVENT_DATE_OFFSET`.
- During docket creation, selected subcategory rules calculate default `dueDate`.
- Manual due-date behavior:
  - `allowManualOverride=true` + request `dueDate` => manual due date is preserved.
  - `allowManualOverride=false` => rule-derived due date wins.
  - `MANUAL_DATE_REQUIRED` requires `dueDate`.
  - `EVENT_DATE_OFFSET` requires `eventDate`.
- Missing required inputs return clear `400` validation errors.
- `slaDueAt` remains SLA-service driven first; when SLA service does not resolve a due date, it falls back to resolved `dueDate`.
- Existing categories/subcategories without `deadlineRule` continue to work (`mode` defaults to `NONE`).

## Notes

- Legal/statutory dates are configurable reference defaults and must be verified by each firm.
- This change does **not** add compliance calendar automation, recurrence, reminders, cron jobs, or government integrations.
