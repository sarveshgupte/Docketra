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

## April 2026: Data-driven setup checklist progression

The dashboard setup checklist now uses role-aware backend detection instead of relying primarily on localStorage toggles.

### API contract
- Endpoint: `GET /api/dashboard/onboarding-progress`
- Response includes:
  - `role`
  - `completed`
  - `total`
  - `steps[]` with:
    - `id`
    - `completed`
    - `source` (`detected` or `manual`)
    - `explanation`
    - `cta` (route intent key)

### Detection model
- Primary Admin: firm setup complete, BYOS connected, active client, category/workbasket readiness, invited teammate, first docket.
- Admin: workbasket visibility, active client presence, category/workbasket readiness, first docket, unassigned queue routed.
- Manager: assigned workbaskets, QC mapping availability, queue visibility with dockets.
- User: assigned workbasket, assigned docket, first workflow interaction.

### Frontend behavior
- `SetupChecklist` now merges backend-detected completion with local manual acknowledgements only when needed.
- Checklist badges explicitly label detected vs manual state.
- Incomplete steps include role-safe CTA routes.
- localStorage is now limited to dismissed state + manual acknowledgements.

- CTA navigation is now separated from completion state for detected steps; opening a page does not mark setup complete.
- Manual acknowledgment is only available for steps explicitly marked `completionMode: manual|hybrid`.

## April 2026: Live onboarding progress refresh after setup mutations

To keep checklist trust high, onboarding progress now refreshes automatically after relevant successful setup mutations.

### Refresh trigger design
- Frontend API response interceptor (`ui/src/services/api.js`) evaluates successful write mutations and emits a lightweight `window` event (`docketra:onboarding-progress-refresh`) for onboarding-relevant endpoints only.
- Matching logic is centralized in `ui/src/utils/onboardingProgressRefresh.js` to keep endpoint coverage maintainable.
- Covered mutation groups include:
  - firm profile/settings updates
  - storage/BYOS changes
  - client creation/updates
  - category/subcategory and workbasket changes
  - user invite/team assignment updates
  - docket create/assign/route/workflow mutation paths

### Dashboard behavior
- Dashboard listens for the refresh event and triggers a debounced onboarding-progress refetch.
- Refetch remains optional/non-blocking: if onboarding refresh fails, primary mutations and core dashboard data flows are unaffected.
- Backend response remains authoritative; no local optimistic completion is applied for detected steps.

## April 2026: Onboarding analytics + blocker observability

Docketra now records lightweight onboarding lifecycle telemetry and exposes superadmin-level onboarding friction insight.

### Event model
- Persistence: `onboarding_events` collection via `src/models/OnboardingEvent.model.js`.
- Core event names:
  - `welcome_tutorial_shown`
  - `welcome_tutorial_completed`
  - `welcome_tutorial_skipped`
  - `product_tour_started`
  - `product_tour_completed`
  - `onboarding_progress_refreshed`
  - `onboarding_step_completed_detected`
  - `onboarding_step_completed_manual`
  - `onboarding_step_cta_opened`
  - `onboarding_checklist_dismissed`
- Minimal event fields: userId, userXID, firmId, role, eventName, optional stepId/source, createdAt, optional lightweight metadata.

### Anti-spam snapshot strategy
- User model includes `onboardingTelemetry` snapshot fields (`lastCompletedStepIds`, `lastIncompleteStepIds`, counters, refreshedAt).
- `GET /api/dashboard/onboarding-progress` now records analytics only on meaningful transitions.
- If progress state is unchanged, no extra onboarding progress or step completion event is written.
- Analytics recording is best-effort and non-blocking; onboarding progress response still returns success if telemetry persistence fails.

### Visibility surface
- New superadmin endpoint: `GET /api/superadmin/onboarding-insights`.
- New superadmin drill-down endpoint: `GET /api/superadmin/onboarding-insights/details`.
- Summary includes:
  - role-aware completion vs incomplete counts
  - top incomplete steps by role
  - tutorial completion vs skip counts
  - recent onboarding events
  - blocker summaries (e.g., managers without queues, users without assigned dockets)
  - firm-level setup signals (e.g., zero active clients)

### Superadmin operational triage UX
- Dedicated page: `/app/superadmin/onboarding-insights`.
- Supports lightweight filters (timeframe, role, blocker type, completion state, stale threshold).
- Shows firm/user-level triage details (progress state, incomplete steps, tutorial status, stale refresh age, recent events) with safe operational next actions.
