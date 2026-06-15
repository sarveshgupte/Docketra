# Docketra design decisions

## June 2026 UI cleanup

### Goal

Keep the workspace feeling like a serious operational platform while removing an obsolete firm list entry point and tightening the shell hierarchy.

### Skills applied

- `impeccable`
- `design-taste-frontend`
- `high-end-visual-design`
- `redesign-existing-projects`
- `stitch-design-taste`

### Decisions made

- Removed `/app/firm/:firmSlug/dockets` from the protected route tree instead of keeping a visible but dead list page.
- Redirected legacy `cases` traffic to `task-manager`, which better matches the current operational hub.
- Preserved docket detail and create routes so existing workflows still function.
- Retargeted dashboard, task-manager, reports, and onboarding entry points to live surfaces instead of the removed registry page.
- Kept the existing design system and shared primitives, then refined spacing, hierarchy, and attention states rather than introducing a new component library.

### Files changed

- `ui/src/routes/ProtectedRoutes.jsx`
- `ui/src/components/common/Layout.jsx`
- `ui/src/components/platform/PlatformShell.jsx`
- `ui/src/components/platform/platform.css`
- `ui/src/pages/platform/DashboardPage.jsx`
- `ui/src/pages/platform/TaskManagerPage.jsx`
- `ui/src/pages/platform/ReportsPage.jsx`
- `ui/src/pages/CreateCasePage.jsx`
- `ui/src/pages/Dashboard.jsx`
- `ui/src/pages/DashboardPage.jsx`
- `ui/src/hooks/useDocketQueueNavigation.js`
- `ui/src/components/onboarding/setupChecklistModel.js`
- `ui/src/components/onboarding/roleOnboardingContent.js`
- `ui/tests/browserRouteActionInventory.test.mjs`
- `ui/tests/dashboardCommandCenter.test.mjs`
- `ui/tests/docketsRouteReliability.test.mjs`
- `ui/tests/firmWorkspaceShellUnification.test.mjs`
- `ui/tests/navigationReliability.test.mjs`
- `ui/tests/pilotLaunchReadinessInventory.test.mjs`

### Risks and tradeoffs

- Docket detail and create URLs still carry `/dockets/...`, so the URL namespace is not fully renamed yet.
- Route-helper aliases for `DOCKETS` and `CASES` remain in `ui/src/constants/routes.js` for compatibility.
- One unrelated admin-surface contract test is currently failing and should be handled separately.

### Follow-up recommendations

- Finish the namespace cleanup by deciding whether `/dockets/:id` and `/dockets/create` should remain canonical or be aliased in the future.
- Continue replacing “All Dockets” copy with Task Manager language where the page is really a queue hub.
- Re-run the full UI CI gate after the admin-surface drift is fixed so the route cleanup lands with a completely green suite.
