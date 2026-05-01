# Auth Routing & Session Model

## Superadmin auth path
- Public entry routes: `/superadmin` and `/superadmin/login`.
- Superadmin login uses xID + password and then profile hydration from `/api/auth/profile` as source of truth.
- Post-login navigation for superadmin is constrained to `/app/superadmin/*`; cross-role `returnTo` paths are ignored.

## Firm auth path
- Public entry route: `/:firmSlug/login`.
- Firm login is tenant-scoped by `firmSlug`; requests without valid firm context are rejected.
- Successful firm auth routes to `/app/firm/:firmSlug/dashboard` (or another safe firm-scoped `/app/firm/:firmSlug/*` route).

## OTP flow
- Login OTP is challenge-based (`/auth/login/init` -> `/auth/login/verify`) and requires profile hydration before navigation.
- Resend behavior must call login resend endpoint for login OTP (`/auth/login/resend`) and signup resend endpoint for signup OTP (`/auth/signup/resend`).

## Profile hydration contract
- The backend auth cookie/session is authoritative.
- Frontend user identity is established only by `/api/auth/profile`.
- Login success is not considered complete until hydration succeeds.

## Logout cleanup contract
- Logout clears server auth cookies and revokes refresh state.
- Client logout clears private query cache plus session keys:
  - `PENDING_LOGIN_TOKEN`
  - `PENDING_LOGIN_FIRM`
  - `POST_LOGIN_RETURN_TO`
- `firmSlug` is a routing hint only and may be preserved only when explicitly requested.

## firmSlug storage rule
- `firmSlug` is never trusted as identity; it is only a route hint.
- Superadmin login must clear stale `firmSlug` hints to prevent workspace misroutes.

## returnTo safety rule
- `returnTo` must be an internal absolute path under `/app`.
- External URLs, protocol-relative URLs, and cross-role namespaces are rejected.
- Superadmin users cannot be redirected into firm routes; firm users cannot be redirected into superadmin routes.

## Cookie / SameSite production expectations
- Auth cookies are `HttpOnly` and path-scoped to `/`.
- `SameSite=None; Secure` is required for cross-site frontend/backend deployments.
- `SameSite=Lax` can be used for same-site deployments.
- Cookie domain should be explicit only when needed and must be host-valid.
