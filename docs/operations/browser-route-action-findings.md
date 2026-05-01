# Browser Route/Action Findings (P0/P1 Focus)

## Scope and method

- Attempted to run the browser inventory from `ui` using `npm run test:browser-route-inventory`.
- In this environment, the run is blocked before scan execution because Playwright Chromium binaries are unavailable and cannot be downloaded from npm registry (`E403`), so inventory output could not be produced.
- As a fallback only, prioritized route/action surfaces were reviewed against current route guards and existing navigation reliability tests.

## Findings table

| Route / Path | Role | Issue type | Likely file(s) | Decision | Status after this PR |
|---|---|---|---|---|---|
| `/app/superadmin` | `superadmin` | page error (inventory runtime blocked in this env) | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/routes/lazyPages.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/superadmin/firms` | `superadmin` | page error (inventory runtime blocked in this env) | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/superadmin/onboarding-insights` | `superadmin` | page error (inventory runtime blocked in this env) | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/superadmin/diagnostics` | `superadmin` | page error (inventory runtime blocked in this env) | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/dashboard` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/worklist` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/global-worklist` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/qc-queue` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/clients` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/constants/platformNavigation.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/crm` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/constants/platformNavigation.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/cms` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/constants/platformNavigation.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/task-manager` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/dockets` | `primary_admin`, `user` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/settings` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/constants/platformNavigation.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/storage-settings` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/ai-settings` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |
| `/app/firm/:firmSlug/admin` | `primary_admin` | none confirmed | `ui/src/routes/ProtectedRoutes.jsx`, `ui/src/constants/platformNavigation.js` | expected and documented | Inventory blocked; no route/action defect confirmed in this PR. |

## Outcome for this PR

- This PR is documentation-only.
- No frontend route/action defect was confirmed from browser inventory output in this environment.
- No frontend route/action code fix was made in this PR.
- A follow-up PR is required once `npm run test:browser-route-inventory` can run successfully and generate `ui/test-results/route-action-inventory.json`.

## Notes

- Existing targeted static tests (`test:navigation`, `test:superadmin-routes`) pass and did not surface regressions in the prioritized route map.
