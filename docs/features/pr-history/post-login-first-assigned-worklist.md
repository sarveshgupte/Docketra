# Post-login first assigned Worklist routing

- After workspace login, users are routed to their first assigned Worklist when available.
- Routing uses assigned workbasket context only (no unassigned queue redirects).
- Intended deep-link redirects are still preserved when safe.
- Safe fallbacks remain: global overview (eligible roles), first assigned QC worklist, then dashboard.
