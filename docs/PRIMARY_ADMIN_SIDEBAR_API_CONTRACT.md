# Primary-Admin Sidebar API Contract

| Section | Page | Frontend Route | API Endpoints Called | Empty-State Response | Required Role |
|---|---|---|---|---|---|
| Daily Operations | Work | `/work` | `GET /api/dockets`, `GET /api/tasks`, `GET /api/search/*` | `200` with empty lists (`[]`) and zero counts | PRIMARY_ADMIN/ADMIN/MANAGER/USER with permissions |
| Daily Operations | Dashboard | `/dashboard` | `GET /api/dashboard/summary`, `GET /api/dashboard/onboarding-progress` | `200` with default summary object and zero values | PRIMARY_ADMIN/ADMIN/MANAGER/USER |
| Firm Memory | Knowledge Intake | `/platform/cms` | `GET /api/leads?limit=100`, `GET /api/forms` | `200` with `data: []` for both lists | PRIMARY_ADMIN/ADMIN/MANAGER |
| Firm Memory | Relationships | `/platform/crm` | `GET /api/crm/clients`, `GET /api/leads`, `GET /api/deals` | `200` with `data: []` list payloads | PRIMARY_ADMIN/ADMIN/MANAGER |
| Firm Memory | Company Brain | `/company-brain` | `GET /api/crm/clients`, `GET /api/knowledge-items` | `200` with empty arrays | PRIMARY_ADMIN/ADMIN/MANAGER |
| Firm Memory | Knowledge Library | `/knowledge-library` | `GET /api/knowledge-items` | `200` with empty array | PRIMARY_ADMIN/ADMIN/MANAGER/USER with permissions |
| Firm Memory | Clients | `/app/firm/:firmSlug/clients` | `GET /api/clients?activeOnly=false&page=1&limit=25` | `200` with `data: []`, `clients: []`, and pagination metadata (`page`, `limit`, `total`) | PRIMARY_ADMIN/ADMIN sidebar visibility today (scoped access handled separately) |
| Oversight | Reports | `/app/firm/:firmSlug/admin/reports` | `GET /api/reports/case-metrics` (+ filtered report endpoints) | `200` with `success: true` and zero/default metrics payload (including empty breakdown/trend/table arrays) when no dockets exist | PRIMARY_ADMIN/ADMIN for now (manager-scoped reports later) |
| Administration | Team & Access | `/admin?tab=users` | `GET /api/admin/users`, `GET /api/admin/hierarchy`, `GET /api/admin/workbaskets` | `200` with `data: []` where applicable | PRIMARY_ADMIN/ADMIN |
| Administration | Settings | `/admin?tab=settings` | `GET /api/admin/firm-settings`, `GET /api/admin/cms-intake-settings` | `200` with normalized settings defaults | PRIMARY_ADMIN/ADMIN |
| Settings Child | Firm Settings | `/settings/firm` | `GET /api/admin/firm-settings` | `200` with safe defaults object | PRIMARY_ADMIN/ADMIN |
| Settings Child | Work Settings | `/settings/work` | `GET /api/settings/audit`, `GET /api/work-types` | `200` with empty arrays where applicable | PRIMARY_ADMIN/ADMIN |
| Settings Child | Storage Settings | `/settings/storage` | `GET /api/storage/configuration`, `GET /api/storage/ownership-summary` | `200` with default configuration object (never 404 on missing config) | PRIMARY_ADMIN/ADMIN |
| Settings Child | AI Settings | `/settings/ai` | `GET /api/ai/configuration` | `200` with default/masked configuration (no plaintext secrets) | PRIMARY_ADMIN/ADMIN/MANAGER (read) |

## Notes
- Frontend CRM client API base path is `/api/crm/clients` (not `/api/crm-clients`).
- Contract requires empty DB state to return `200` with empty arrays/default objects, not `404`.
- Secrets (API keys/tokens) must remain masked in all responses.
