# Landing page import — May 2026

## Lovable source repository
Attempted source repository: `https://github.com/guptesarvesh/firm-operating-system`.

## Scope
Frontend-only marketing import into `/` landing surface. No backend code, auth logic, protected workspace routes, superadmin route definitions, or firm-slug login routing behavior were changed.

## Sections imported into Docketra landing
1. Sticky header/navigation
2. Hero
3. Product dashboard mockup
4. Problem section
5. Product pillars
6. Workflow section
7. Superadmin / oversight / pilot readiness section
8. Trust / privacy / storage section
9. Use cases
10. Final CTA
11. Footer

## CTA routes and behavior
- `Request early access` → `/signup`
- `View product overview` → in-page section navigation (`#why`)
- `Contact` → `mailto:hello@docketra.com`
- `Login` → `/login`

No placeholder `href="#"` links are used.

## Privacy and storage wording
Landing copy explicitly states:
- BYOS-first approach with firm-controlled storage where configured.
- Metadata-only oversight for pilot/readiness monitoring.
- AI is off by default unless explicitly enabled.

## Files changed
- `ui/src/components/landing/LandingPageContent.jsx`
- `ui/tests/publicLandingRouteSmoke.test.mjs`
- `ui/tests/companyBrainLandingPage.test.mjs`
- `docs/frontend/LANDING_PAGE_IMPORT_2026-05.md`

## Tests run
- `cd ui && npm run build`
- `cd ui && node tests/publicLandingRouteSmoke.test.mjs`
- `cd ui && node tests/companyBrainLandingPage.test.mjs`
- `cd ui && node tests/routingPublicBoundaryRegression.test.mjs`
- `cd ui && node tests/authRedirectBehavior.test.mjs`

## Rollback notes
1. Revert the files listed in **Files changed**.
2. Re-run build + route tests listed above.
3. Verify `/`, `/login`, `/signup`, and `/:firmSlug/login` behavior remains unchanged.
