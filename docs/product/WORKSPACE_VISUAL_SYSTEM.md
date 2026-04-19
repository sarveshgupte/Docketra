# Workspace Visual System (April 2026)

## Purpose

This document captures the shared visual polish and enterprise-density rules for Docketra's unified workspace surfaces.

## Canonical authenticated shell contract (PR 1004)

For all authenticated firm-facing routes (`/app/firm/:firmSlug/*`), **`PlatformShell` is the single canonical shell**.

- Keep `FirmLayout` as route guard/context only.
- Keep route-level loading in the same workspace structure by using `PlatformRouteLoadingShell`.
- Keep page-level structure consistent:
  1. `PlatformShell` with `moduleLabel`, `title`, `subtitle`, and optional shell-level `actions`.
  2. Use `PageHeader` inside the body **only for distinct internal sections**, not to repeat shell metadata.
  3. Content sections in cards/tables below header with consistent spacing (`space-y-4` baseline).
  4. Empty/loading/error states rendered *inside* `PlatformShell` to avoid shell flashes during navigation.

### Header/action duplication rule

- Do **not** render the same page title/subtitle in both `PlatformShell` and `PageHeader`.
- Do **not** render the same action CTA in both `PlatformShell.actions` and `PageHeader.actions`.
- Preferred default: use `PlatformShell` metadata only; add `PageHeader` only when section hierarchy is genuinely different.

### Deprecated pattern

- `components/common/Layout.jsx` is deprecated for authenticated firm-facing pages.
- Do not introduce new authenticated route pages on `Layout`.
- Existing remaining `Layout` usage should be treated as migration debt and moved to `PlatformShell` in small, safe follow-up PRs.

## Spacing rules adopted

1. Use compact, predictable vertical rhythm in platform surfaces:
   - topbar and sidebar tightened for all-day operational usage,
   - content gutter and section/card spacing reduced to improve density without clutter.
2. Keep section composition consistent:
   - section header (title + optional description/actions) followed by content with minimal but clear separation.
3. Maintain one panel framing language:
   - consistent border, radius, and subtle shadow across cards/panels.

## Typography hierarchy rules adopted

1. Shell hierarchy order:
   - module label (small uppercase anchor),
   - page title,
   - subtitle,
   - breadcrumb/meta line.
2. Section hierarchy:
   - section title with stronger weight,
   - description in muted text with tighter spacing.
3. Metrics/tables:
   - metric labels standardized to compact uppercase treatment,
   - table headers use compact uppercase framing for scan speed.

## Density decisions

1. Control sizing normalized:
   - topbar actions, filter controls, and section action buttons use compact height and consistent padding.
2. Navigation density improved:
   - reduced nav item height and spacing while preserving active-state clarity.
3. Table/list density improved:
   - reduced row padding,
   - compact body text,
   - sticky header framing,
   - tighter row action buttons.

## Table/card/header polish principles

- Favor information density over decorative whitespace.
- Avoid consumer-style heavy shadows and oversized cards.
- Keep empty/loading/error feedback visible but contained.
- Keep primary and secondary action zones aligned and predictable.
- Preserve readability by balancing compact spacing with line-height and contrast.

## Large page decomposition pattern (PR 1005)

To prevent high-risk monolith pages from regressing, use this composition contract for large frontend pages:

1. **Shell/container (`pages/...`)**
   - Keep the page file focused on route params, permission gates, high-level orchestration, and shell framing.
   - Keep authenticated pages on `PlatformShell`; do not reintroduce `Layout`.
2. **Header/actions (`components/...`)**
   - Extract header action rails into focused components (`PageHeader` actions, metrics chips, quick actions).
3. **Filters/toolbar (`components/...`)**
   - Move filter forms, view tabs, saved views, and bulk bars into dedicated sections with explicit props.
4. **Content/table (`components/...` + hooks)**
   - Keep table column definitions and row action renderers out of giant page files.
   - Prefer a page-local hook (for example `use*TableColumns`) when table behavior grows complex.
5. **Dialogs/modals (`components/...`)**
   - Keep modal state orchestration in the page container when needed, but extract repeated modal UI blocks.
6. **Hooks/state (`hooks/...` or page-local hooks)**
   - Extract reusable async orchestration and derived state so page files stay readable.
   - Keep abstractions concrete and behavior-preserving; avoid speculative framework layers.

### Guardrail

New or refactored large pages should not grow back into “everything files” that mix layout, fetch orchestration, filters, table renderers, and dialog logic in one place.

## Follow-up items

1. Continue migrating any remaining authenticated pages still using legacy `Layout` wrappers.
2. Add queue-specific column-width contracts only where needed for domain-heavy tables.
3. Add visual regression checks for shared shell/table primitives when screenshot automation is available.

## PR 1004 migration notes

Migrated to canonical shell in this pass:

1. Audit logs (`/app/firm/:firmSlug/admin/audit-logs`)
2. CRM clients (`/app/firm/:firmSlug/crm/clients`)
3. Detailed reports (`/app/firm/:firmSlug/admin/reports/detailed`)
4. Reports dashboard (legacy reports surface)

Additional shell-stability update:

- `RouteLoadingShell` now uses `PlatformRouteLoadingShell` for firm workspace route loading (including `/app/dashboard` redirect entry) to reduce stale/legacy shell flashes during route transitions.
