# Session Timeout Audit — May 2026

## Issue found
- Users were being forced through re-authentication more aggressively than product expectations during normal working pauses.
- No centralized frontend idle-session policy constant existed; backend refresh cookie maxAge could be configured below the intended inactivity window.

## Configured idle timeout
- Frontend idle timeout is now centralized at `SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000`.
- Keepalive interval is centralized at `SESSION_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000`.
- Backend now enforces refresh cookie maxAge floor to at least 3 hours.

## Frontend files changed
- `ui/src/utils/constants.js`
- `ui/src/contexts/AuthContext.jsx`

## Backend files changed
- `src/config/session.config.js`
- `src/services/authSession.service.js`

## Cookie/session behavior
- `accessToken` cookie remains short-lived and HttpOnly.
- `refreshToken` cookie remains HttpOnly/Secure/SameSite-controlled by existing runtime rules.
- Refresh cookie maxAge is now clamped to at least the 3-hour inactivity policy.
- Active user interaction resets the frontend idle timer; inactivity beyond 3 hours triggers logout.

## Interceptor behavior audit summary
- Existing interceptor behavior already avoided auth clearing on transient network failures and non-auth 5xx responses.
- 401 still leads to refresh attempt and then login redirect on genuine expiry/revocation.

## Tests added/updated
- Updated `tests/authSessionCookieModel.test.js` to assert refresh cookie `maxAge` is at least 3 hours.
- Added `ui/tests/authSessionInactivitySourceGuards.test.mjs` to assert:
  - 3-hour idle constant;
  - listener registration is gated behind authenticated state;
  - logout/keepalive timers use centralized constants;
  - timeout/interval/listener cleanup and duplicate interval guard patterns are present.

## Future direction (docs-only, not implemented here)
- Enterprise SSO (Microsoft Entra ID / Google Workspace).
- Windows/domain-device login where supported.
- Passwordless firm login policies.
- Reducing repeated email/password/OTP prompts once enterprise identity is configured.
