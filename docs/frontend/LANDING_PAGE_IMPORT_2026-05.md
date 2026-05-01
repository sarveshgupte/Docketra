# Landing Page Import (May 2026)

## Source repository
- Intended source: `https://github.com/guptesarvesh/firm-memory-hub`.
- Note: direct network fetch from the build environment failed with HTTP 403 during clone, so the import was completed by porting/adapting the existing Lovable-style landing implementation already present in Docketra and restructuring it into the requested component layout.

## Files/components copied or adapted
- `ui/src/components/landing/LandingPageContent.jsx`
  - Created by moving the full landing-page implementation out of `ui/src/pages/marketing/HomePage.jsx`.
  - Preserved section structure and behavior (hero, problem, solution, product pillars, flow examples, trust, CTA, footer).
  - Updated branding CTA details for Docketra public routes.
- `ui/src/pages/marketing/HomePage.jsx`
  - Reduced to a thin page wrapper that renders `LandingPageContent`.

## Assets copied
- No additional static assets were added.
- Existing design and mock UI blocks are Tailwind-based and remain in component markup.

## Dependencies added or avoided
- Added: none.
- Reused existing dependencies already in Docketra frontend (`react-router-dom`, `framer-motion`, and existing `Container` layout component).

## Routes touched
- No route definitions changed.
- Existing `/` route continues to render `MarketingHomePage`, now backed by `LandingPageContent` via `HomePage` wrapper.
- CTA links wired to existing public routes:
  - Primary CTA: `/signup`
  - Login CTA: `/login`

## Verification steps
1. Run frontend build.
2. Validate `/` loads the landing page.
3. Validate `/login` route still renders login UI.
4. Validate `/signup` route still renders onboarding/signup UI.
5. Validate `/:firmSlug/login` still renders firm login.
6. Confirm protected routes remain unchanged (no edits to protected/public route maps beyond component implementation).

## Rollback notes
- Revert the following files to roll back this import:
  - `ui/src/components/landing/LandingPageContent.jsx` (delete)
  - `ui/src/pages/marketing/HomePage.jsx` (restore prior monolithic page)
  - `docs/frontend/LANDING_PAGE_IMPORT_2026-05.md` (delete)
