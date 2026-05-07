# Route Authorization Audit — May 2026

## Scope
- Backend route audit across all routers under `src/routes/` and route mounts in:
  - `src/app/routes/mountPlatformRoutes.js`
  - `src/app/routes/mountTenantRoutes.js`
- Reviewed auth middleware, tenant identity model, and firm-scoped controls:
  - `src/middleware/auth.middleware.js`
  - `docs/architecture/auth-middleware.md`
  - `docs/architecture/tenant-identity-model.md`
  - `docs/security/FIRM_SCOPED_LOGIN_SECURITY.md`
  - `tests/firmRbac.test.js`

## Route categories reviewed

### Public
- `health.routes.js`
- `public.routes.js`
- `publicSignup.routes.js`
- `contact.routes.js`
- `firm.routes.js` (`/api/:firmSlug/*` login/setup-status only)
- Public auth endpoints in `auth.routes.js` (login/init/verify, forgot-password, signup, OTP)

### Authenticated firm user (tenant-scoped)
- `case.routes.js`, `docket.routes.js`, `docketSession.routes.js`, `attachment.routes.js`, `files.routes.js`, `docketFileStorage.routes.js`
- `client.routes.js`, `crmClient.routes.js`, `clientApproval.routes.js`
- `task.routes.js`, `complianceCalendar.routes.js`, `notifications.routes.js`, `search.routes.js`
- `reports.routes.js`, `insights.routes.js`, `dashboard.routes.js`, `firmMetrics.routes.js`
- `team.routes.js`, `user.routes.js`, `selfUser.routes.js`, `settings.routes.js`
- `workType.routes.js`, `category.routes.js`, `tenant.routes.js`
- `storage.routes.js`, `ai.routes.js`, `firmStorage.routes.js`
- `lead.routes.js`, `deal.routes.js`, `invoice.routes.js`, `form.routes.js`, `landingPage.routes.js`
- Authenticated endpoints in `auth.routes.js` (`/profile`, `/logout`, `/change-password`, etc.)

### Firm admin only / role-restricted within firm
- `admin.routes.js`
- Admin-restricted endpoints in `sla.routes.js`, `knowledgeItem.routes.js`, `team.routes.js`, `firmStorage.routes.js`, `storage.routes.js`, `ai.routes.js`, `auth.routes.js` admin user management endpoints

### Primary admin only
- Explicit primary-admin checks in:
  - `admin.routes.js` (activate/deactivate users, hierarchy/settings mutations)
  - `user.routes.js` role/reporting/delete endpoints
  - `team.routes.js`, `storage.routes.js`, `ai.routes.js`

### Superadmin only
- `superadmin.routes.js` (all endpoints)
- `security.routes.js`
- Superadmin login entrypoints mounted in `mountPlatformRoutes.js`

### Internal/system only
- None exposed as explicit external API class; debug namespace remains authenticated + admin-guarded when enabled.

## Issues found and fixed
1. **Superadmin route guard consistency risk**
   - Some `superadmin.routes.js` endpoints relied on policy middleware only while others also included `requireSuperadmin` at route level.
   - Fix: add router-level `router.use(requireSuperadmin)` fail-closed guard so all superadmin routes are uniformly protected, regardless of per-route policy wiring.

## Public routes intentionally preserved
- Kept health, public signup/contact, public upload-token flows, firm login/setup-status, and public auth initiation/reset flows unchanged.
- No additional auth gates added to intentionally public endpoints.

## Tests added
- `tests/routeAuthorizationConformance.test.js`
  - Asserts superadmin router has global `requireSuperadmin` enforcement.
  - Asserts tenant-scoped mounts enforce `forbidSuperAdmin: true` on firm routes.
  - Asserts superadmin namespaces are mounted consistently.
  - Asserts reserved slug protections remain present.

## Follow-up recommendations
- Add an automated route manifest generator that snapshots each mount path + middleware chain to make drift visible in CI.
- Incrementally convert string/regex structural checks to request-level integration tests with fixture identities for:
  - firm user vs admin vs primary admin
  - cross-tenant resource IDs
  - superadmin denial on tenant business data routes.
