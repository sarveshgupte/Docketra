# Task Manager MVP Pilot Surface

This document defines the pilot-visible product surface for Task Manager MVP.

## Pilot-visible (firm users)
- My Worklist
- Global Worklist / Workbasket
- QC Queue (when access is already wired)
- Dockets list
- Docket detail
- Create docket
- Clients (for docket creation and context)
- Work settings / team setup required for assignment and workbasket flows
- Profile
- Notifications (where already working)
- Logout

## Hidden/disabled for pilot
The following modules are intentionally hidden from firm navigation and blocked from normal route entry points during pilot:
- CRM
- CMS
- Company Brain
- Knowledge Library
- AI Settings
- Storage Settings
- Data Storage Map
- Reports (including detailed reports)
- Product updates and other non-essential surfaces

Implementation details:
- Centralized pilot-surface config is defined in `ui/src/constants/pilotSurface.js`.
- Non-MVP routes are preserved in code, but gated to redirect to Worklist for pilot safety.
- SuperAdmin auth and dashboard remain enabled; only pilot-essential superadmin nav links are shown.
