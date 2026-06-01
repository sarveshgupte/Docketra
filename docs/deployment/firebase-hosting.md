# Firebase Hosting deployment (Docketra `ui/`)

## Why Firebase Hosting (not App Hosting)
Docketra frontend is a Vite SPA producing static assets (`ui/dist`), so **Firebase Hosting is the minimal, stable fit**.

## Files used
- `firebase.json`
- `.firebaserc`
- `ui/.env.production.example`

## Build and deploy
```bash
cd ui
npm ci
VITE_API_BASE_URL="https://api.example.com/api" npm run build
cd ..
firebase deploy --only hosting
```

## SPA routing
`firebase.json` includes a catch-all rewrite to `/index.html` so React Router routes work on hard refresh.

## Environment variables checklist (frontend)
- `VITE_API_BASE_URL` (required): full API URL, e.g. `https://api.example.com/api`
- `VITE_ENABLE_GOOGLE_LOGIN` (optional)
- `VITE_GOOGLE_CLIENT_ID` (optional unless frontend directly calls Google Identity SDK)

## Firebase project setup checklist
1. Create/select Firebase project.
2. Enable Hosting.
3. Set `.firebaserc` default project.
4. Build `ui/` with production env vars.
5. Deploy hosting.

## Google OAuth callback + authorized origins checklist
- Add Firebase domain(s) to Google OAuth **Authorized JavaScript origins**.
- Keep backend callback URI pointing to API domain (`/api/auth/google/callback`).
- Verify tenant/firm scoped login still redirects to the expected frontend domain.

## Custom domain checklist
- Map custom domain in Firebase Hosting.
- Validate TLS certificate issuance.
- Update `FRONTEND_URL` / `FRONTEND_ORIGINS` backend envs.

## Smoke tests
- Load login page from custom domain.
- Hard refresh on deep route (e.g. `/firm-slug/login`) returns SPA, not 404.
- API calls resolve to `VITE_API_BASE_URL` (network tab check).
- OAuth sign-in starts from frontend and completes via backend callback.

## Rollback
- Re-deploy prior Hosting release from Firebase console.
- Revert `VITE_API_BASE_URL` to previous backend endpoint if needed.

## Known limitations / deferred follow-ups
- No SSR or per-request server logic on Hosting (not needed currently).
- If SSR is needed later, evaluate Firebase App Hosting or Cloud Run SSR adapter.
