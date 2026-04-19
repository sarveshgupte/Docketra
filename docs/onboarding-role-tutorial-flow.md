# Role-specific onboarding and tutorial flow

## Overview
Docketra now uses a two-layer onboarding experience:

1. **Welcome tutorial (first login)**
   - Multi-step modal explaining:
     - What Docketra is
     - What the user role means
     - What actions are allowed
     - Where to start
     - Quick-start checklist
2. **Contextual product tour (dashboard)**
   - Role-aware tour with practical steps and direct navigation actions to relevant pages.

The flow is designed for production B2B teams and uses Docketra terminology (dockets, workbaskets, QC, compliance, audit history, BYOS/BYOAI).

## Roles covered
- Superadmin
- Primary Admin
- Admin
- Manager
- User

Role normalization is implemented in a shared frontend content module and backend profile response logic to keep role mapping consistent.

## Frontend wiring

### Welcome tutorial
- Component: `ui/src/components/onboarding/FirstLoginExperience.jsx`
- Rendered globally in: `ui/src/App.jsx`
- Content source: `ui/src/components/onboarding/roleOnboardingContent.js`

Behavior:
- Automatically opens on first login when `welcomeTutorial.show` is true.
- Supports **Back / Next / Skip / Finish** controls.
- Stores completion/skip via `PATCH /api/users/tutorial/complete`.
- Can be replayed manually from Dashboard Help section using a custom event (`docketra:replay-welcome-tutorial`). Manual replay is UI-only and does not persist skip/complete state.

### Dashboard contextual tour
- Page: `ui/src/pages/DashboardPage.jsx`
- Role-based steps built with `buildRoleTourSteps(...)`.
- Steps include:
  - human-readable guidance
  - optional highlight selector (`data-tour-anchor`)
  - direct CTA route to open the target page

### Setup checklist
- Component: `ui/src/components/onboarding/SetupChecklist.jsx`
- Modes now support:
  - `primary-admin`
  - `admin`
  - `manager`
  - `user`

Checklist state is persisted in localStorage by user + firm key.

## Backend persistence and contract

### Data model
`User` now includes:
- `tutorialCompletedAt: Date | null` (backward compatibility)
- `tutorialState` object:
  - `seenAt`
  - `skippedAt`
  - `completedAt`
  - `role`
  - `lastStepIndex`

### API
`PATCH /api/users/tutorial/complete`
- accepts optional payload:
  - `status`: `completed | skipped`
  - `role`
  - `stepIndex`

### Auth profile contract
`GET /api/auth/profile` returns `welcomeTutorial` with:
- `show`
- `role`
- `status`
- `steps`

## Empty-state improvements
Dashboard “Recent Dockets” empty states now guide users based on role:
- admin-focused setup direction
- manager assignment/workbasket direction
- user assignment-pending guidance

## Safety and permissions notes
- Guidance is conservative by role and avoids promising controls that may be restricted.
- Optional feature references (BYOAI/BYOS/QC) are framed as conditional and do not block onboarding.
- Existing auth and route behavior remain unchanged.
