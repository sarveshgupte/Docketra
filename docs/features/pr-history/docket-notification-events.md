# Docket notification events (MVP)

Implemented in this PR:
- Docket assigned to me (`DOCKET_ASSIGNED`)
- Docket routed to my Workbasket (`DOCKET_ROUTED_TO_WORKBASKET`)
- QC returned docket for correction (`QC_RETURNED`)
- Pended docket reopened (`PENDED_DOCKET_REOPENED`)

Notes:
- No browser push notifications.
- No popup/toast behavior changes.
- Notification writes are non-blocking and failures are safely logged.
- Recipient checks enforce firm scope and skip deleted users.
- Due soon/overdue is deferred to a follow-up PR for safe due-date infra alignment.
