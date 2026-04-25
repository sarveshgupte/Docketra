# Frontend Routing Model (Public vs Protected)

## Goals
- Keep `/` strictly public and always render the marketing landing page.
- Keep tenant (`/:firmSlug/*`) and superadmin (`/app/superadmin*`) auth boundaries explicit.
- Prevent stale storage values from hijacking public navigation.

## Route namespaces

### Public routes (no auth guard)
- `/` → marketing home.
- `/login` → public login entry point.
- `/superadmin/login` → canonical superadmin login route.
- `/superadmin` → backward-compatible alias (same login UI).
- `/:firmSlug/login` → firm-specific login UI.
- public utility routes (`/signup`, `/forgot-password`, `/reset-password`, `/upload/:token`, `/forms/:formId`, etc.).

### Firm protected routes
- `/app/firm/:firmSlug/*`.
- All protected firm pages are wrapped by `ProtectedRoute` without `requireSuperadmin`.
- Unauthenticated access redirects to a validated firm login path (`/:firmSlug/login`) with `returnTo` when safe.

### Superadmin protected routes
- `/app/superadmin*`.
- Wrapped by `ProtectedRoute` with `requireSuperadmin`.
- Unauthenticated access always redirects to `/superadmin/login`.

## Redirect rules
- Visiting `/` never checks local storage firm slug and never auto-redirects to login pages.
- `DefaultRoute` only redirects authenticated users to their validated destination.
- If unauthenticated, `DefaultRoute` returns to `/` (safe public landing).
- If authenticated and firm context is missing for non-superadmin, fallback is `/complete-profile` (never localStorage dashboard fallback).
- Guard redirects attach `returnTo` only for allowed internal `/app/*` targets.
- API 401 handling avoids loop redirects when already on login-like routes.

## Post-login flow (deterministic)
- Firm login uses `/auth/login/init`:
  - if `otpRequired`, UI stays on firm login page and switches to OTP step.
  - if a direct session payload is returned, UI immediately hydrates profile.
- OTP verification uses `/auth/login/verify` and only considers login complete after:
  1) auth cookies/session are applied, and
  2) `/auth/profile` hydration succeeds.
- Final route selection is centralized via `resolvePostAuthNavigation`:
  - parses `returnTo` directly from URL query,
  - allows only internal `/app/*` paths,
  - rejects external/protocol-relative/malformed values,
  - enforces role-compatible namespace,
  - falls back safely to `resolvePostAuthRoute(user)`.
- If auth succeeds but profile/workspace hydration fails, UI shows an actionable error and does not silently stall.
- OTP verification can resume from `sessionStorage` only if pending firm matches the current sanitized firm slug.
- On pending-token mismatch/expiry, flow resets to credentials step with a clear message (no loop).

## Firm slug validation
- Slugs are sanitized through `sanitizeFirmSlug`:
  - lowercase
  - strict pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
  - rejects reserved slugs (`app`, `superadmin`, `login`)
- Invalid or stale slugs are discarded.
- If no valid slug exists, firm login fallback uses `/login` (public safe route).

## Storage keys used for auth/routing
- `localStorage.firmSlug` → optional routing hint (validated before use).
- `localStorage.impersonatedFirm` → superadmin impersonation metadata.
- `localStorage.authLogoutBroadcastAt` → cross-tab logout broadcast.
- `sessionStorage.GLOBAL_TOAST` → one-time UX toast across redirects.

## Logout cleanup behavior
- Logout clears authenticated in-memory state and query cache.
- Clears impersonation state and (unless explicitly preserved in controlled flows) firm slug hint.
- Clears pending login OTP/session keys (`PENDING_LOGIN_TOKEN`, `PENDING_LOGIN_FIRM`, `POST_LOGIN_RETURN_TO`).
- Broadcasts logout event for other tabs.
- Post-logout, opening `/` remains public and does not auto-route to firm/superadmin login.
