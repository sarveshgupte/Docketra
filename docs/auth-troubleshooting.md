# Auth Routing Troubleshooting (Production)

## Canonical auth route map

### Superadmin auth
- **Login:** `POST /api/superadmin/login` (legacy alias: `POST /superadmin/login`)
- **Profile/session verification:** `GET /api/auth/profile` (legacy alias: `GET /auth/profile`)
- **Logout:** `POST /api/auth/logout` (legacy alias: `POST /auth/logout`)
- **Protected superadmin API namespace:** `/api/superadmin/*` and `/api/sa/*`

### Firm user auth
- **Firm metadata for login page:** `GET /api/:firmSlug/login`
- **Firm login:** `POST /:firmSlug/login` (UI-facing) and `POST /api/:firmSlug/login` (API-facing)
- **Profile/session verification:** `GET /api/auth/profile`
- **Logout:** `POST /api/auth/logout`

### Generic auth routes used by frontend bootstrap/guards
- `GET /api/auth/profile`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`


## Canonical route mount order (server)

1. Platform auth namespaces are mounted first:
   - `/api/auth`
   - `/auth`
2. Superadmin login endpoints are mounted next:
   - `POST /api/superadmin/login`
   - `POST /superadmin/login`
3. Protected superadmin namespaces are mounted before tenant slug routes:
   - `/api/sa/*`
   - `/api/superadmin/*`
   - `/superadmin/*`
4. Tenant slug routes are mounted only after platform namespaces:
   - `/api/:firmSlug/*`
   - `/:firmSlug/login`

## Reserved API namespaces

The following namespaces are reserved and must **never** be interpreted as `:firmSlug`:
- `/api/auth/*`
- `/api/superadmin/*`
- `/api/public/*`
- `/api/admin/*`
- `/api/dashboard/*`
- plus other platform namespaces defined in `RESERVED_FIRM_SLUGS`.

## Why 404 can happen

If `:firmSlug` interception runs before auth/superadmin routes and incorrectly treats
`auth` or `superadmin` as a tenant slug, requests can bypass intended route handlers and end in a 404.

## Regression checks

Run:

```bash
node tests/authSuperadminRouteRegression.test.js
```

Expected guarantees:
- `POST /api/superadmin/login` does not return 404.
- `GET /api/auth/profile` does not return 404 (returns `200/401/403` depending on auth state).
- `/api/superadmin/*` and `/api/auth/*` are not intercepted by firm slug resolution.

## Startup diagnostics

In `NODE_ENV !== production`, server startup logs `AUTH_ROUTE_MOUNTS` with:
- canonical login/profile/logout routes,
- protected superadmin base paths,
- reserved firm namespace slugs.

No secrets are logged.

## Firm login workspace-status smoke test

When debugging `/[:firmSlug]/login` showing `Invalid workspace URL` unexpectedly:

1. Call `GET /api/:firmSlug/login` directly and inspect `data.status` and `data.isActive`.
2. Backend may return uppercase status values such as `"ACTIVE"`.
3. Frontend must treat workspace as active when either:
   - `isActive === true`, or
   - `String(status || '').toLowerCase() === 'active'`.
4. Frontend must **not** rely on exact lowercase status comparisons only.

Example valid active payload:

```json
{
  "success": true,
  "data": {
    "firmSlug": "gupte-opc",
    "name": "Gupte OPC",
    "status": "ACTIVE",
    "isActive": true
  }
}
```
