# Daily Operations navigation groups

- Daily Operations now separates assigned **Workbaskets**, **Worklists**, and **QC Worklists**.
- Queue names are dynamic and sourced from the logged-in user assignment context.
- Worklists are workbasket-scoped via `workbasketId` query routing.
- QC work remains separated under QC Worklists.
- Normal Worklist status filtering no longer exposes `In QC`.
- No example queue names are hardcoded in production navigation.
