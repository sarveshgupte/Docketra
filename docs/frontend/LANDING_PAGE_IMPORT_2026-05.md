# Landing page import — May 2026

## Scope
This change is intentionally limited to the **public marketing landing page** at `/` in the frontend (`ui/`).
No backend, auth flow logic, protected app routes, superadmin routes, or firm-slug login behavior were modified.

## Landing page structure
The landing page is rendered from:
- `ui/src/pages/marketing/HomePage.jsx`
- `ui/src/components/landing/LandingPageContent.jsx`

Sections:
1. Sticky landing header (desktop + mobile menu)
2. Hero section with primary (`/signup`) and secondary (in-page) CTAs
3. Problem section (`#why`)
4. Solution section
5. Product pillars section (`#product`)
6. In-practice section (`#in-practice`)
7. Trust section (`#trust`)
8. Final CTA section
9. Landing footer

## Routes touched
No route definitions were changed in this import.
`/` continues to render `MarketingHomePage` directly (not nested under `MarketingLayout`), while other marketing/legal pages continue to use `MarketingLayout`.

## Duplicate header/footer prevention
`/` is registered in `PublicRoutes` outside `MarketingLayout`, so it uses only the landing-specific header/footer from `LandingPageContent` and is not wrapped by shared marketing layout chrome.

## CTA routes
- Primary CTA: `Request early access` -> `/signup`
- Secondary hero CTA: `See how it works` -> in-page anchor scroll (`#why`)
- Header CTA: `Request early access` -> `/signup`
- Header login: `Login` -> `/login`
- Final secondary CTA: `mailto:hello@docketra.com`

## Storage and AI wording
Trust copy reflects supported behavior:
- BYOS can be used where configured
- Docketra default storage may be used when BYOS is not configured
- Storage configuration should be visible to the primary admin
- AI is off by default unless explicitly enabled
- No implicit claims about automatic AI/vector indexing

## Tests run
- `cd ui && npm run build`
- `cd ui && node tests/publicLandingRouteSmoke.test.mjs`
- `cd ui && node tests/routingPublicBoundaryRegression.test.mjs`
- `cd ui && node tests/authEndpointContract.test.mjs`

## Rollback notes
To rollback this import:
1. Revert `ui/src/components/landing/LandingPageContent.jsx` and `ui/src/pages/marketing/HomePage.jsx` to previous commit state.
2. Re-run `cd ui && npm run build` and route smoke tests.
3. Confirm `/`, `/login`, `/signup`, and `/:firmSlug/login` behavior remain unchanged.
