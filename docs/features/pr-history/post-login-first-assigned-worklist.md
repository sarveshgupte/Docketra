# Post-login first assigned Worklist routing

## Summary
- Firm users now land on their first assigned Worklist after login when no safe deep-link return path is present.
- Deep-link redirects are preserved and still take priority when the intended route is safe.
- Fallback sequence is: assigned Worklist → Workbasket Overview (manager/admin+) → assigned QC Worklist → Dashboard.
- Routing decisions only use assigned queue context and never route users to unassigned queues.
