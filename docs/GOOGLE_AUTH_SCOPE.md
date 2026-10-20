# Google Auth Scope in Docketra

## Status (May 2026)

Google OAuth is active for **Workspace Signup & Authentication** as well as **BYOS Storage Connection**:

- **Active:** Google OAuth for workspace signup (`/signup`), firm login (`/:firmSlug/login`), and invite setup.
- **Active:** Google OAuth for **Google Drive BYOS** connection and token refresh.

## Auth Routes

The following canonical routes handle Google authentication:

- `GET /api/auth/google/start` — Initiates Google OAuth consent for login or workspace signup.
- `GET /api/auth/google/callback` — Handles Google OAuth code redirection, verifies Google ID token, and either generates session or redirects with pending signup state.
- `POST /api/auth/google/exchange` — Exchanges one-time Google exchangeToken for authenticated JWT session.
- `POST /api/auth/google/complete-signup` — Completes workspace creation for Google-authenticated users by naming their firm.

## Frontend Auth Flows

- `/signup` (`Signup.jsx`): Exposes "Create account with Google" alongside traditional credentials setup.
- `/oauth/post-auth` (`OAuthPostAuthPage.jsx`): Handles callback token exchange and provides workspace naming flow for new signups.
- `/:firmSlug/login` (`FirmLoginPage.jsx`): Exposes "Continue with Google" for firm members.

## Active Storage Routes (BYOS)

These routes and services power Google Drive integration for storage:

- `GET /api/storage/google/connect`
- `GET /api/storage/google/callback`
- `POST /api/storage/google/confirm-drive`

## Environment Variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_AUTH_REDIRECT_URI` (or `GOOGLE_CALLBACK_URL`)
- `GOOGLE_OAUTH_REDIRECT_URI` (for BYOS Drive)
- `DISABLE_GOOGLE_AUTH` (optional feature flag to disable Google auth)

