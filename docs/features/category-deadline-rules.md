# Category/Subcategory Deadline Rules

This feature adds configurable subcategory-level deadline defaults in Category Management.

- Rules are stored under `subcategory.deadlineRule`.
- Rule modes: `NONE`, `TAT_DAYS`, `FIXED_DAY_NEXT_MONTH`, `MANUAL_DATE_REQUIRED`, `EVENT_DATE_OFFSET`.
- During docket creation, selected subcategory rules can calculate `dueDate` and influence `slaDueAt` behavior via existing flow.
- Existing categories/subcategories without `deadlineRule` continue to work (defaults to `NONE`).

## Notes

- Legal/statutory dates are configurable reference defaults and must be verified by each firm.
- This change does **not** add compliance calendar automation, recurrence, reminders, cron jobs, or government integrations.
