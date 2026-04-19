# Workspace Visual System (April 2026)

## Purpose

This document captures the shared visual polish and enterprise-density rules for Docketra's unified workspace surfaces.

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

## Follow-up items

1. Extend these exact contracts to remaining legacy pages not yet fully centered on `PlatformShell`.
2. Add queue-specific column-width contracts only where needed for domain-heavy tables.
3. Add visual regression checks for shared shell/table primitives when screenshot automation is available.
