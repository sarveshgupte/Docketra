# Route Mounting Architecture

## Route Layer Order (createApp)
1. Global middleware (helmet, cors, request lifecycle, global limiters).
2. Health/metrics mounts (`/health`, `/api/health`, `/metrics`, `/api/metrics/security`).
3. Platform/public/auth mounts (`/api`, `/api/auth`, `/auth`, `/api/public`, `/public`, `/api/admin`, `/api/superadmin`, etc.).
4. Tenant slug mount (`/api/:firmSlug`) for slug-scoped login/OTP routes.
5. Authenticated tenant/business routes (`/api/users`, `/api/tasks`, `/api/dockets`, etc.).
6. Fallback and error middleware (`notFound`, upload error handler, final error handler).

## Reserved Namespace Rules
The following namespaces are platform-reserved and must **never** be interpreted as `firmSlug`:
- `/api/auth`
- `/auth`
- `/api/public`
- `/public`
- `/api/superadmin`
- `/superadmin`
- `/api/admin`
- `/api/users`

## Why `/api/:firmSlug` Must Stay Later
Express 5 path matching can capture broad params early. If `/api/:firmSlug` is mounted before reserved namespaces, requests intended for platform auth/public/admin/superadmin can be misrouted into tenant flows. That risks auth boundary regressions and tenant-context leakage.

## Safe Process for Future Route Additions
- Add new platform routes in `mountPlatformRoutes` before `/api/:firmSlug` when namespace is reserved/shared.
- Add tenant business routes in `mountTenantRoutes`.
- Preserve existing middleware chains exactly when moving mounts.
- Run contract tests:
  - `tests/express5FirmSlugRouting.test.js`
  - `tests/routeMountOrderContract.test.js`
- Avoid introducing behavior changes in structural refactors.
