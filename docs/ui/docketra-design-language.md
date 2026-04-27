# Docketra Design Language (Foundation)

## Intent

Docketra’s 2026 product UI should feel premium, professional, warm, and operationally efficient for daily B2B workflows (CRM, CMS, dockets, worklists, tasking, admin/superadmin, settings, reports, BYOS/BYOAI surfaces).

This foundation PR defines shared visual primitives only. It does **not** redesign each page.

## Source adaptation (not copying)

- **Linear adapted:** operational precision (clear shell hierarchy, compact readable tables/lists, clean action priority).
- **Notion adapted:** warm neutrals, near-black text, whisper borders, restrained depth.
- **Intercom adapted:** approachable enterprise form clarity and explicit state messaging.

## What was intentionally not copied

- No Linear dark-first identity or exact dark product look.
- No Notion brand/IP (NotionInter, layout mimicry, blank-canvas behavior).
- No Intercom orange brand identity, playful marketing patterns, or proprietary type.
- No external/proprietary fonts (Inter/system stack only).

## Docketra token model

Defined in `ui/src/assets/styles/tokens.css` under `--dt-*`:

- **Backgrounds/surfaces:** `--dt-bg`, `--dt-bg-warm`, `--dt-surface`, `--dt-surface-raised`, `--dt-surface-muted`, `--dt-surface-subtle`
- **Text:** `--dt-text`, `--dt-text-secondary`, `--dt-text-muted`, `--dt-text-disabled`, `--dt-text-inverse`
- **Borders:** `--dt-border-whisper`, `--dt-border`, `--dt-border-strong`
- **Accent/focus:** `--dt-accent`, `--dt-accent-hover`, `--dt-accent-active`, `--dt-accent-subtle`, `--dt-focus`, `--dt-focus-ring`
- **Semantic:** success/warning/error/info + subtle backgrounds
- **Radius:** control/card/panel/pill
- **Shadows:** card/popover/modal
- **Typography:** sans/mono, role-based sizes, body/tight line-height tokens

## Rules

### Typography
- Inter/system only.
- Near-black text (`--dt-text`) over warm-light surfaces.
- Restrained negative tracking only on major headings.
- Preserve readability in forms/tables.

### Spacing
- 8px-driven operational rhythm.
- Compact controls and dense, scannable list surfaces.

### Borders/radius/shadow
- Whisper borders by default.
- Control radius 8px, card 10px, panel 12px, pill 999px.
- Soft depth only where functional (cards, popovers, modals).

### Buttons
- Primary = Docketra blue accent.
- Secondary/outline = quiet neutral controls.
- Danger remains explicit.
- Focus-visible ring required and obvious.

### Cards/containers
- Warm-white surfaces with whisper borders.
- Avoid over-carding.

### Forms
- Consistent borders, helper/error text, and focus states.
- Disabled/read-only remain legible.

### Badges/status
- Pill format, semantic meaning preserved.
- Use semantic hues for meaning, not decoration.

### Tables/lists
- Preserve scan speed and compact density.
- Keep existing sorting/filtering/pagination/row-interaction behaviors untouched.

### Accessibility baseline
- Visible focus-visible rings.
- Readable disabled state.
- Status not color-only in interaction contexts.
- Link/button visual distinction preserved.

## Rollout plan (next PRs)

1. Continue replacing hardcoded colors in high-traffic shared wrappers first.
2. Migrate legacy `neo-*` and page-local ad hoc CSS gradually per module.
3. Apply tokenized page-header/section/table contracts route-by-route (no behavior changes).
4. Add focused visual regression checks on shared primitives and shell surfaces.

## Foundation PR visual QA checklist

- Login screen
- App shell (sidebar + topbar)
- Dashboard
- All Dockets
- Worklist
- CRM
- CMS
- Admin
- Settings
- Modal
- Empty state
- Table with filters
- Form with error/success states
