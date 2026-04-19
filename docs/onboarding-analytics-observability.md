# Onboarding analytics and blocker observability

## Scope
This feature adds lightweight onboarding telemetry and superadmin-facing friction insight using Docketra's real onboarding progress model.

## April 2026 refinement: actionable superadmin triage
- Added dedicated superadmin triage page: `/app/superadmin/onboarding-insights`.
- Added detail API: `GET /api/superadmin/onboarding-insights/details`.
- Added filter controls for timeframe, role, blocker type, completion state, and stale threshold.
- Added firm-level and user-level operational rows with actionable next-step pathways (for example, open firms management / firm controls).
- Preserved existing summary API (`GET /api/superadmin/onboarding-insights`) for backward compatibility and lightweight dashboard rendering.

## Architecture
- **Event persistence**: `src/models/OnboardingEvent.model.js` (`onboarding_events` collection)
- **Analytics logic**: `src/services/onboardingAnalytics.service.js`
- **Transition trigger**: `src/controllers/dashboard.controller.js` on `GET /api/dashboard/onboarding-progress`
- **UI event ingestion**: `POST /api/dashboard/onboarding-event`
- **Superadmin summary API**: `GET /api/superadmin/onboarding-insights`
- **Superadmin detail API**: `GET /api/superadmin/onboarding-insights/details`
- **Visibility UI**: `ui/src/pages/PlatformDashboard.jsx`
- **Actionable triage UI**: `ui/src/pages/SuperadminOnboardingInsightsPage.jsx`

## Event contract
Each event stores only operationally necessary fields:
- `userId`
- `userXID`
- `firmId`
- `role`
- `eventName`
- optional `stepId`
- optional `source` (`detected`/`manual`)
- `createdAt`
- optional small `metadata`

No third-party analytics SDK is used.

## Anti-noise strategy
- User profile keeps `onboardingTelemetry` snapshot state.
- Progress refresh writes only when completed/incomplete step sets change.
- Detected step completion events are emitted only for newly completed steps.

## Insights returned
`GET /api/superadmin/onboarding-insights` returns:
- firm-level setup blockers
- role completion distribution
- common incomplete steps by role
- tutorial completion/skip funnel
- users who skipped tutorial but remain incomplete beyond threshold
- recent onboarding events

## Operational notes
- Event writes are best-effort and non-blocking for core product flows.
- Onboarding completion analytics reflect actual backend-detected/manual transitions only.
- Role-aware metrics distinguish `PRIMARY_ADMIN`, `ADMIN`, `MANAGER`, and `USER`.
- If telemetry persistence fails during onboarding progress or tutorial completion, API success responses are preserved and only warning logs are emitted.
- Platform stats rendering remains authoritative even when optional onboarding-insights loading fails.
