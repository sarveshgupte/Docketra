# Daily Operations Navigation Groups

- Daily Operations now separates assigned Workbaskets, Worklists, and QC Worklists.
- Queue names are dynamic and sourced from logged-in user assignment context (`accessContext.workbaskets` and `accessContext.qcWorkbaskets`).
- Worklists are now workbasket-scoped through `workbasketId` query links from sidebar children.
- QC work remains separated under QC Worklists.
- Normal Worklist no longer exposes `In QC` status/metric context.
