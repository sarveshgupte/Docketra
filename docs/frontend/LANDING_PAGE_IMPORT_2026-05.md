# Landing Page Import (May 2026)

## Duplicate header/footer root cause
- The public root route (`/`) was grouped under `MarketingLayout` in `ui/src/routes/PublicRoutes.jsx`.
- `MarketingLayout` wraps content with `AppLayout`, which renders the shared `Navbar` and marketing footer.
- The imported Lovable-style landing component (`LandingPageContent`) also renders its own `HomeNav` and `MarketingFooter`.
- Result: duplicate header and duplicate footer on `/`.

## Routing fix
- Moved `/` out of the `MarketingLayout` route group and into a plain `RouteSuspenseOutlet` group.
- Kept `MarketingLayout` for these pages only:
  - `/features`
  - `/terms`
  - `/privacy`
  - `/security`
  - `/acceptable-use`
  - `/about`
  - `/contact`
  - `/login`
  - `/superadmin`
  - `/superadmin/login`
- Left all other public/auth/firm-slug routes unchanged.

## Routes verified
- `/` now renders only the landing-specific `HomeNav` and `MarketingFooter` (single header/footer).
- `/login` still routes via the existing login page.
- `/signup` remains unchanged.
- `/:firmSlug/login` remains unchanged.
- `/features`, `/about`, `/contact`, `/terms`, `/privacy`, `/security`, `/acceptable-use` still render through `MarketingLayout` as before.
- Legacy superadmin redirect route (`/superadmin/*` -> `/app/superadmin*`) remains unchanged.

## Copy corrections made
- Updated Trust/BYOS copy to avoid absolute custody claims.
- New wording reflects both supported modes:
  - BYOS where configured.
  - Docketra default storage may be used when BYOS is not configured.
- Added clarity that storage configuration should be visible to the primary admin.

## Rollback notes
- To roll back this cleanup, revert:
  - `ui/src/routes/PublicRoutes.jsx`
  - `ui/src/components/landing/LandingPageContent.jsx`
  - `docs/frontend/LANDING_PAGE_IMPORT_2026-05.md`

## Final QA audit (May 1, 2026)
- Confirmed `/` renders a single landing header (`HomeNav`) and single landing footer (`MarketingFooter`) with no `MarketingLayout`/`AppLayout` wrapper.
- Confirmed all landing section anchors (`#why`, `#product`, `#in-practice`, `#trust`) are present and wired through `handleSectionNavigation` with sticky-header offset scrolling.
- Confirmed CTA wording is consistent on landing (`Request early access`) including footer CTA label.
- Re-validated trust copy avoids hard custody claims and correctly states BYOS/default-storage behavior.
- Re-checked there are no fake metrics, testimonials, or customer logos in landing content.

### Footer links reviewed
- Valid/routable and kept: `/features`, `/about`, `/contact`, `/terms`, `/privacy`, `/security`, `/acceptable-use`.
- Correction made: footer CTA label changed from `Sign up` to `Request early access` (still routed to `/signup`) for consistency with hero/final CTA.

### Route smoke coverage added
- Added `ui/tests/publicLandingRouteSmoke.test.mjs` to assert:
  - route registrations for `/`, `/login`, `/signup`, `/:firmSlug/login`, and all marketing/legal footer routes;
  - `/` stays outside `MarketingLayout`;
  - `/` renders landing-specific `HomeNav` and `MarketingFooter`;
  - marketing/legal pages continue under `MarketingLayout` and `AppLayout`.
