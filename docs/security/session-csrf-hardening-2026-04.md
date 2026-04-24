# Session + CSRF Hardening Note (April 2026)

## Scope
Hardening pass for session lifecycle, CSRF/origin consistency, logout invalidation, and websocket auth lifecycle before pilot usage.

## Routes and middleware audited
- Global mutating-route enforcement now runs through `enforceSameOriginForMutatingRequests` for `POST`, `PUT`, `PATCH`, `DELETE` at server middleware level.
- Existing auth-route same-origin protection remains in place for `/api/auth` and `/auth` route groups.
- Auth/session routes re-checked: login init/verify/resend, refresh, logout, forgot/reset flows, signup init/verify/resend.
- Notification socket auth handshake and post-connect lifecycle were audited.

## CSRF / origin behavior
- Mutating requests run centralized same-origin checks **only for cookie-authenticated requests**.
- Allowed origin comparison supports request host and configured frontend origins.
- Missing `Origin`/`Referer` still allows non-browser/internal callers to preserve compatibility.
- Explicit skip coverage is kept for internal health/metrics/CSP-report style paths to avoid accidental operational breakage.

## Cookie/session decisions
- Auth cookies remain `HttpOnly` and `Secure` in production.
- `SameSite` is now configurable via `AUTH_COOKIE_SAMESITE` with safe fallback (`lax`; `none` only honored in production).
- Optional `AUTH_COOKIE_DOMAIN` is supported for domain-scoped deployments.
- Invalid/revoked refresh handling now clears auth cookies to avoid stale-session loops.

## Logout + invalidation behavior
- Logout revokes user refresh tokens and now also disconnects active notification sockets for the same user + firm.
- Frontend logout clears auth context and React Query cache, emits a logout lifecycle event, and broadcasts multi-tab logout via localStorage.
- Other tabs consume the broadcast and clear auth/client state immediately.

## Websocket lifecycle behavior
- Socket handshake still requires valid cookie-based access token and active user in the current firm.
- Replaced per-socket timers with a centralized scheduler + per-socket jittered revalidation windows to reduce synchronized DB pressure.
- Invalid/revoked/expired states force disconnect during revalidation.
- Added targeted server-side disconnect hook for logout-triggered invalidation.

## Tests added/updated
- `tests/serverCsrfMutationWiring.test.js`
- `tests/notificationSocketSessionLifecycle.test.js`
- `tests/authSession.refreshAccessToken.test.js` (extended cookie-clearing assertion)
- `ui/tests/authRefreshLoopRegression.test.mjs` (extended logout/cache/multi-tab assertions)

## Manual QA checklist
- [ ] Login and profile hydration succeed with normal browser flow.
- [ ] Logout removes access (API calls return unauthenticated) and redirects safely.
- [ ] Refresh succeeds for valid session and rotates cookies.
- [ ] Invalid/expired refresh does not loop; session resolves unauthenticated.
- [ ] Protected routes do not render private data before auth resolution.
- [ ] Notification socket disconnects after logout.
- [ ] Multi-tab logout clears auth state in all open tabs.
- [ ] Invite flow, signup/workspace onboarding, BYOS Google Drive flows remain functional.
- [ ] Upload/document mutating endpoints continue working from first-party frontend origin.

## Known follow-up items
- Add integration-level e2e tests for cross-origin deployment matrices (`app.*` + `api.*`) including proxy/header behavior.
- Add centralized security metrics dashboard card for socket disconnect reasons (expired token vs manual logout vs inactive user).
