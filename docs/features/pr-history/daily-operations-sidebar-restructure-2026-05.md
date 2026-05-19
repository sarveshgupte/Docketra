# Daily Operations sidebar restructure (May 2026)

## Summary

The Daily Operations sidebar now uses explicit queue-oriented navigation:

- **Workbaskets** for team queue intake and assigned workbasket links.
- **My Worklist** as a first-class personal execution queue.
- **QC Worklist** for review/quality queue access and assigned QC workbasket links.

## What changed

- Replaced the previous single vague Work-centric entry with clearer queue labels.
- Added a dedicated **My Worklist** entry for all firm users.
- Added a dedicated **QC Worklist** entry when user role/assignment permits QC access.
- Removed direct link capping so all assigned workbaskets and QC workbaskets render.
- Kept direct route structure and guard compatibility for workbasket and QC workbasket detail pages.

## Access model

- Direct **Workbasket** links route to `/workbaskets/:workbasketId` and remain assignment-guarded.
- Direct **QC Workbasket** links route to `/qc-workbaskets/:workbasketId` and remain assignment-guarded.
- QC visibility is still role-aware (manager/admin tiers) or assignment-aware.
