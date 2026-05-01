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
