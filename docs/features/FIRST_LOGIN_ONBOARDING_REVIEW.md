# First-login onboarding review (implemented)

## Features that should be shown to users on first login (tutorial)

Based on the current codebase capabilities, first-login onboarding should explicitly call out:

1. **Dashboard risk visibility**
   - Overdue, due-soon, pending-review, and execution health metrics are surfaced as KPI cards.
2. **Docket lifecycle workflow**
   - Dockets move through lifecycle states with status, priority, ownership, and due-date controls.
3. **Workbasket vs Worklist operating model**
   - Workbasket supports intake/triage; Worklist is the execution queue for assigned users.
4. **Collaboration and accountability**
   - Assignment, comments, and status updates keep progress visible across the firm.
5. **Operational visibility**
   - Notification history and audit-friendly event trails support oversight and follow-up.

## Firm setup steps for a PRIMARY_ADMIN after first-login tutorial

After completing the tutorial modal, the PRIMARY_ADMIN setup sequence should be:

1. Confirm **Firm Settings** (profile + compliance defaults).
2. Configure **Storage Settings** (provider connection and file-handling readiness).
3. Configure **Work Settings** (categories + work types taxonomy).
4. Invite users and establish the initial hierarchy from **Admin**.
5. Create and assign the first docket to validate end-to-end execution.

## Tutorials for other roles

### ADMIN (non-primary)
After tutorial, admins should be guided to:
1. Validate their hierarchy and access scope in **Admin**.
2. Activate/invite execution users.
3. Create and assign initial dockets.
4. Triage intake in **Workbasket** and move work to **Worklist**.
5. Monitor dashboard risk cards daily.

### USER / EMPLOYEE
After tutorial, users should be guided to:
1. Start daily from **My Worklist**.
2. Update status/comments for active dockets.
3. Escalate unassigned/blocked dockets to admins.
4. Use filters/search to prioritize due-soon work.
5. Keep profile/contact info updated for alerts.

## What was implemented

- First-login modal now includes a dedicated **Key product features** section for all users.
- First-login modal now includes role-specific post-tutorial setup guidance for:
  - `PRIMARY_ADMIN`
  - `ADMIN`
  - `USER/EMPLOYEE`
- Backend profile tutorial-role resolution now recognizes `PRIMARY_ADMIN` as admin onboarding.
- Dashboard now serves a dedicated **Primary Admin setup checklist** with direct navigation actions:
  - Firm settings
  - Storage settings
  - Work settings
  - Team management
  - First docket creation
