# Primary-Admin Sidebar Endpoint Discovery Findings

Date: 2026-05-02
Scope: Discovery-only endpoint probe for known failing sidebar API requests.
Method: `createApp + supertest` diagnostic script with temporary auth/tenant stubs.

> Note: This is **not** a production-faithful auth/tenant validation run. The script uses temporary stubs to isolate route-level behavior and surface failure classes quickly.

## Results

| Endpoint | Status | Error/body highlights | Likely owning route/controller | Failure class | Recommended fix PR |
|---|---:|---|---|---|---|
| `GET /api/leads?limit=100` | 500 | `code: FIRM_RESOLUTION_FAILED`, `message: Failed to resolve firm context` | `src/routes/lead.routes.js` → `src/controllers/lead.controller.js` | Tenant/firm context resolution dependency | PR-2: Fix firm-context resolution path for tenant-scoped lead/form routes in empty/offline test state and confirm 200 empty list |
| `GET /api/forms` | 500 | `code: FIRM_RESOLUTION_FAILED`, `message: Failed to resolve firm context` | `src/routes/form.routes.js` → `src/controllers/form.controller.js` | Tenant/firm context resolution dependency | PR-2: Same class as leads |
| `GET /api/clients?activeOnly=false&page=1&limit=25` | 404 | Empty body | `src/routes/client.routes.js` → `src/controllers/client.controller.js` | Route-level 404 under current harness | PR-1: Route mounting/route-group chain validation and low-risk route-path fixes |
| `GET /api/reports/case-metrics` | 404 | Empty body | `src/routes/reports.routes.js` → `src/controllers/reports.controller.js` | Route-level 404 under current harness | PR-1: Route mounting/route-group chain validation and low-risk route-path fixes |
| `GET /api/storage/configuration` | 404 | Empty body | `src/routes/storage.routes.js` → `src/controllers/storage.controller.js` | Route-level 404 under current harness | PR-1: Route mounting/route-group chain validation and low-risk route-path fixes |
| `GET /api/ai/configuration` | 404 | Empty body | `src/routes/ai.routes.js` → `src/controllers/ai.controller.js` | Route-level 404 under current harness | PR-1: Route mounting/route-group chain validation and low-risk route-path fixes |

## Next steps

1. **Route-level 404 class first** (clients/reports/storage/ai):
   - Validate createApp mount order and route-group middleware interactions.
   - Add passing authenticated contract tests for these endpoints returning 200.
2. **Firm-resolution 500 class second** (leads/forms):
   - Resolve tenant/firm context dependency mismatch and ensure empty-state returns 200 with array payload.
3. Keep auth model unchanged in these focused PRs.
