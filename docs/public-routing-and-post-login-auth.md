# Public Routing And Post-Login Auth

## Route Groups

- Public routes do not pass through `ProtectedRoute`. `/` renders the marketing landing page, `/superadmin/login` renders the superadmin login page, and `/:firmSlug/login` renders the firm login page for that slug.
- Firm-auth routes live under `/app/firm/:firmSlug/*`. Logged-out users are sent to `/:firmSlug/login` with a validated `returnTo` query only for protected app routes.
- Superadmin-auth routes live under `/app/superadmin/*`. Logged-out users are sent only to `/superadmin/login`.

## Redirect Rules

- The root `/` is always public. Stored `firmSlug`, stale superadmin state, old user data, and previous redirect targets must not change root routing.
- `returnTo` is accepted only when it is an internal `/app/*` route and matches the authenticated user's namespace:
  - firm users may return only to `/app/firm/{theirFirmSlug}/*`
  - superadmin users may return only to `/app/superadmin/*`
- Invalid, cross-role, stale, external, empty, or malformed redirect targets are ignored.
- No route should redirect from login to login, OTP to login, root to login, or dashboard to login after successful profile hydration.

## Post-Login Flow

Default destination logic is centralized in `ui/src/utils/authRedirect.js`.

- Superadmin users default to `/app/superadmin`.
- Firm users default to `/app/firm/:firmSlug/dashboard`.
- Authenticated users missing firm context go to `/complete-profile`.
- Unauthenticated users default to `/superadmin/login` only when they enter a protected superadmin/default app route, never from `/`.

## XID/Password And OTP

Firm XID/password login calls `/auth/login/init`.

- If the API returns an access token, the UI stores session routing hints, force-fetches `/auth/profile`, then navigates to a validated `returnTo` or the firm dashboard fallback.
- If the API returns `otpRequired` and `loginToken`, the UI stays on the firm login page and moves to the OTP step.
- OTP verification calls `/auth/login/verify`, then performs the same forced profile hydration and validated navigation.
- If profile hydration fails after API login success, the UI shows an actionable error and does not loop.

The generic `/auth/otp` page also force-fetches profile after OTP success before entering the app.

## Session And Workspace Hydration

The client does not hydrate identity from localStorage. `AuthContext` gets identity from `/api/auth/profile`; `firmSlug` in localStorage is only a routing hint. Protected routes show a loading shell while auth hydration is unresolved, and dashboard/workspace entry happens after profile hydration succeeds.

## Storage Keys

Routing/auth-related localStorage keys:

- `firmSlug`
- `impersonatedFirm`
- `authLogoutBroadcastAt`
- deprecated cleanup keys: `xID`, `user`

Routing/auth-related sessionStorage keys:

- `GLOBAL_TOAST`
- `pendingLogin`
- `pendingOtp`
- `redirectTarget`

## Logout Cleanup

Logout clears auth state, query cache, impersonation state, firm routing hints, deprecated user/xID storage, pending login/OTP state, redirect targets, and cross-tab logout markers. Firm and platform shells keep the current slug in memory only long enough to navigate the user back to the visible login page; it is not preserved in storage.

## API Expiry Handling

The API interceptor retries refresh once for protected requests. On refresh failure or non-public 401, it clears stale auth/routing storage, preserves the expiry toast, and redirects by current namespace:

- `/app/superadmin/*` or `/superadmin/*` to `/superadmin/login`
- firm app routes to the resolved firm login path

Public auth endpoints do not force redirects on expected 401 responses.

## Failure Handling

- Invalid firm slugs render the firm login error state and link back to `/`.
- Missing profile after successful login shows a retry/contact-admin message.
- Cross-role redirects are ignored and replaced with the authenticated user's default dashboard.
- 403 authorization failures keep the session active and show an access warning.
