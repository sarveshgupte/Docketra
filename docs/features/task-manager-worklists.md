# Task Manager Worklist / Workbasket Operating Model (Canonical)

> **Status:** Canonical product rules for upcoming implementation PRs.
> 
> This document defines the source-of-truth operating model. It does **not** claim that backend or UI enforcement is already implemented.

## Purpose

This document defines the canonical Docketra Task Manager operating model for:
- User Worklists (WL)
- Team Workbaskets (WB)
- QC Workbaskets (QC WB)
- All Dockets

These rules must guide future backend and frontend implementation PRs.

## Terminology

- **User Worklist / WL:** A user's personal working list. A docket appears here when assigned to that user via `assignedToXID`.
- **Workbasket / WB:** A team queue. Every team such as HR, Legal, Ops, Compliance, or any admin-created team has its own WB.
- **QC Workbasket / QC WB:** Every WB has one linked QC WB.
- **All Dockets:** Firm-wide filtered docket list. It is not a queue. It includes active, pending, resolved, filed, assigned, unassigned, and other non-deleted dockets.

## Core Rules

1. Every user has a Worklist.
2. Every team has a Workbasket.
3. Every Workbasket has its own QC Workbasket.
4. A user can be linked to HR, Legal, Ops, or any custom team/WB created by Admin or Primary Admin.
5. Every active non-superadmin user must be linked to at least one WB.
6. The manager of a WB is automatically linked to that WB's QC WB.
7. Admin, Primary Admin, and the WB manager can add additional users to the QC WB.
8. Primary Admin and Admin can see all WBs.
9. Normal users can see only WBs they are linked to.
10. Users linked to a WB can pull dockets from that WB into their own WL.
11. Managers can move dockets from WB to WL.
12. Managers can move dockets between users' WLs.
13. Admin and Primary Admin can pull any WB docket into their own WL and can assign any WB docket to others.
14. A docket created under a category/subcategory must route to that category/subcategory's mapped WB.
15. Newly created unassigned dockets go to the mapped WB, not directly to a user WL.
16. A user pulls the docket from WB to WL to work on it.
17. If a user pends a docket, it remains owned by that same user. It must reopen into that same user's WL.
18. Pending does not pause TAT.
19. WB waiting time counts in TAT.
20. QC time counts in TAT.
21. If a user is deactivated, disabled, or deleted, all non-terminal dockets assigned to that user move back to the current category/subcategory-linked WB.
22. Resolved and filed dockets must not appear in any active WB or WL.
23. Resolved and filed dockets appear in All Dockets.

## Category/Subcategory Mapping Rules

- Each category/subcategory must be linked to a WB.
- When a new docket is created, it goes to the currently mapped WB.
- If the category/subcategory mapping changes later:
  - dockets already assigned to a user WL stay where they are;
  - unassigned dockets still sitting in a WB move to the newly mapped WB.

## WB Deactivation Rules

- A WB with unassigned dockets cannot be deactivated.
- Deactivation must be blocked until unassigned dockets are moved or cleared.

## Manager Change Rules

- New manager auto-links to the QC WB.
- Old manager is removed from the QC WB unless explicitly added as a QC user.

## Routing Rules

- A docket can be routed from one WB/team to another only from inside the docket detail page.
- There must be a Route button inside the docket.
- Clicking Route shows all team/WB names.
- Routing requires a compulsory comment.
- Route history must be preserved.
- Routed docket moves to the receiving team's WB.
- A user from the receiving team can pull it into their WL.
- Routed docket can be routed onward to another team if needed.
- Receiving team must not see File for routed dockets.
- Receiving team must not use Resolve for routed completion.
- Routed-team completion must be called Submit, not Resolve.
- Submit means: "my team has completed its routed part."
- Submit returns the docket to the original routing user's WL.
- Submit does not finally resolve the docket.
- Resolve is only for final docket closure by the owner/originator or authorized manager/admin.

## Example Route Flow

1. HR user owns a docket.
2. HR user routes it to Legal WB with compulsory comment.
3. Legal user pulls it to Legal WL.
4. Legal user works on it.
5. Legal user can pend it or submit it.
6. Legal user cannot file it.
7. Legal user does not resolve it finally.
8. Legal user clicks Submit.
9. Docket returns to the original HR user's WL.
10. HR user can then resolve, file, route again, or continue work.

## QC Rules

- QC passed -> docket is resolved.
- QC failed -> docket returns to the user who submitted the docket for QC.
- QC corrected -> docket is resolved, but record that it was QC failed/corrected for that user for future QC reports.
- QC reports will be built later, but the data model/docs should preserve this requirement.

## All Dockets Rules

- All Dockets is not a queue.
- It must include active, pending, resolved, filed, assigned, unassigned, and other non-deleted dockets.
- It must support filters.
- No user should pull from All Dockets.

## Short Lifecycle

- Created -> mapped WB
- Pull -> user WL
- Pend -> same user ownership, TAT still running
- Reopen -> same user WL
- Route -> receiving WB
- Pull routed docket -> receiving user's WL
- Submit routed work -> original routing user's WL
- Send to QC -> linked QC WB
- QC failed -> user who submitted for QC
- QC passed -> resolved
- Resolve/File -> All Dockets only
