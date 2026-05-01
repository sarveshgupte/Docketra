# Superadmin Surface Reliability (Pilot Readiness)

## Active Superadmin Routes

| Route | Component |
|---|---|
| `/app/superadmin` | `PlatformDashboard` |
| `/app/superadmin/firms` | `FirmsManagement` |
| `/app/superadmin/onboarding-insights` | `SuperadminOnboardingInsightsPage` |
| `/app/superadmin/onboarding-insights/:firmId` | `SuperadminFirmOnboardingDetailPage` |
| `/app/superadmin/diagnostics` | `SuperadminDiagnosticsPage` |

All routes are protected with `requireSuperadmin` in `ProtectedRoutes` and loaded via `RouteSuspenseOutlet` for lazy-load resilience.

## Superadmin Navigation Contract

Visible sidebar links are limited to implemented protected routes above:
- Platform Dashboard
- Firms
- Onboarding Insights
- Support Diagnostics

No placeholder links (`href="#"`) are allowed in Superadmin layout navigation.

## Hidden/Disabled Routes and Actions

No additional Superadmin nav routes are currently exposed. Unimplemented routes/actions are not surfaced in the Superadmin sidebar.

## Expected Loading / Empty / Error States

- `/app/superadmin/firms`
  - Loading: spinner with loading message.
  - Empty: “No firms exist yet” and create action.
  - Error: top-level error panel with retry button if no data can be loaded.
- `/app/superadmin/onboarding-insights`
  - Loading: spinner with loading message.
  - Empty/Error: “Insights unavailable” empty state with retry action.
- `/app/superadmin/onboarding-insights/:firmId`
  - Missing `firmId`: explicit error copy and retry path.
  - Empty/Error: “No firm onboarding detail found” with retry action.
- `/app/superadmin/diagnostics`
  - Loading: spinner with loading message.
  - Empty/Error: “Diagnostics unavailable” empty state with retry action.

## Route-to-Component Mapping Source of Truth

- Route declarations: `ui/src/routes/ProtectedRoutes.jsx`
- Lazy import contract: `ui/src/routes/lazyPages.jsx`
- Navigation links: `ui/src/components/common/SuperAdminLayout.jsx`
