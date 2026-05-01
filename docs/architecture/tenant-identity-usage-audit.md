# Tenant Identity Usage Audit (Backend)

_Date: May 1, 2026_

| File | Usage | Expected Identity | Status | Recommended Action |
|---|---|---|---|---|
| `src/controllers/storage.controller.js` | `resolveOwnershipFirmId()` + `Firm.findById(ownershipFirmId)` for storage config/export/disconnect | ownership firm (`Firm._id`) | Safe | Keep ownership resolution fail-closed. |
| `src/controllers/storage.controller.js` | `writeSettingsAudit(... tenantId: req.firmId ...)` in storage export/disconnect flows | ownership firm for firm-owned settings audit | **Unsafe (fixed)** | Use `ownershipFirmId` as audit tenant id; include `runtimeTenantId` in metadata only. |
| `src/controllers/tenantStorage.controller.js` | `Firm.findByIdAndUpdate(tenantId)` after `tenantId = req.firmId` | ownership firm (`Firm._id`) | **Unsafe (fixed)** | Resolve ownership via `req.ownershipFirmId` / resolver and fail closed when missing. |
| `src/controllers/files.controller.js` | `tenantId = req.firmId`, `TenantStorageConfig.findOne({ tenantId })`, case/file tenant scoping | runtime tenant (workspace default client `_id`) | Safe | Keep tenant-scoped enforcement in controller and route guard. |
| `src/controllers/docketFileStorage.controller.js` | (reviewed) tenant-scoped storage file operations | runtime tenant | Needs follow-up | Continue periodic review for any `Firm` model ownership access. |
| `src/controllers/ai.controller.js` | `resolveStorageContextFromTenantId(req.firmId)` then `Firm.findById(ownershipFirmId)` | ownership firm | Safe | No changes needed; already fail-closed on missing ownership. |
| `src/controllers/admin.controller.js` | multiple `Firm.findById(firmId)` with firm-scoped settings/storage | ownership firm | Needs follow-up | Validate each route's upstream identity mapping in dedicated follow-up PR. |
| `src/repositories/ClientRepository.js` | `Client.find/findOne({ firmId: ownershipFirmId })` | ownership firm id persisted on Client docs | Safe | Keep canonical repo-level ownership scoping. |
| `src/services/productAudit.service.js` | `tenantId` canonical field consumed by settings audit | caller-defined | Safe | Callers handling firm-owned settings must pass ownership id explicitly. |
| `src/middleware/firmContext*.js` | `req.firmId`, `req.ownershipFirmId`, `req.context.*` population | both runtime + ownership | Safe | Keep as identity bridge for legacy controllers. |
| `src/controllers/*` legacy patterns | `req.jwt.firmId` fallback and `Client.find({ firmId })` in some controllers | mixed legacy | Needs follow-up | Convert remaining legacy consumers incrementally with regression tests. |

## Summary of this PR hardening

- Corrected firm-owned storage settings writes to use ownership firm id consistently.
- Ensured firm-owned storage/settings audit uses ownership id as canonical tenant boundary.
- Added regression tests for ownership resolution fallback and audit tenant id semantics.

## Controller follow-up review (admin/settings/report/client/CRM/lead)

| File | Usage | Scope | Status | Notes |
|---|---|---|---|---|
| `src/controllers/admin.controller.js` | `Firm.findById(...)` in firm settings/CMS/storage/disconnect | ownership firm (`Firm._id`) | **Fixed · Intentionally ownership-scoped** | Now resolves from `req.ownershipFirmId` and fails closed when absent; no runtime fallback to `req.user.firmId` for `Firm` reads/writes. |
| `src/controllers/admin.controller.js` | case/user/category/team queries (`firmId` filters) | runtime tenant/default client | Safe · Intentionally runtime-scoped | Kept runtime scoping for tenant datasets. |
| `src/controllers/reports.controller.js` | report filters and export logs using `req.user?.firmId || req.firmId` | runtime tenant/default client | Safe · Intentionally runtime-scoped | Superadmin explicitly blocked for firm-scoped report endpoints. |
| `src/controllers/client.controller.js` | storage mode check `Firm.findById(...)` | ownership firm (`Firm._id`) | **Fixed · Intentionally ownership-scoped** | Storage configuration lookup now keyed by ownership firm id only; missing ownership disables storage path. |
| `src/controllers/client.controller.js` | client CRUD/query scoping via repository | runtime tenant/default client (mapped to ownership in repo) | Safe | No behavioral refactor; existing repository boundary remains. |
| `src/controllers/crmClient.controller.js` | CRM/client/deal/case/invoice filters by `req.user.firmId` | runtime tenant/default client | Safe · Intentionally runtime-scoped | No `Firm` ownership operations present. |
| `src/controllers/lead.controller.js` | lead/user/client/case scoping by `req.user.firmId` | runtime tenant/default client | Safe · Intentionally runtime-scoped | No `Firm` ownership operations present. |
| `src/controllers/firmMetrics.controller.js` | metrics filtered by `req.firmId` | runtime tenant/default client | Safe · Intentionally runtime-scoped | Aggregate-only runtime metrics endpoint. |
| `src/controllers/settings.controller.js` | file not present in current codebase | N/A | Needs follow-up | Validate route ownership model if this controller is reintroduced. |
