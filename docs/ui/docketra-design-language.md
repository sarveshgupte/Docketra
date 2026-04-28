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

## Legacy page token adoption guidance (post-foundation)

To migrate legacy high-traffic pages safely after foundation rollout:

1. **Replace only presentation values**
   - Swap local hardcoded colors (gray/slate/blue/red/amber/hex) to existing `--dt-*` tokens.
   - Prioritize wrappers and dense list surfaces first (`CasesPage`, settings detail pages, CRM/CMS dense lists).

2. **Preserve density contract**
   - Do **not** increase row heights, filter bar heights, card padding, or form vertical rhythm during token adoption.
   - Token migration should improve consistency without making operational views feel airy.

3. **Preserve semantic colors intentionally**
   - Keep success/warning/error/info states clearly distinguishable using semantic `--dt-*` tokens.
   - Do not flatten semantic messaging into neutral tones.
   - Destructive actions must remain visually dangerous; disabled states must stay readable.

4. **Focus-visible and accessibility parity**
   - Ensure migrated controls still use clear `--dt-focus`/`--dt-focus-ring` affordances.
   - Maintain contrast in status banners, table messages, and action controls.

5. **No behavior coupling**
   - Token migration PRs must avoid route, API, payload, validation, RBAC/auth, pagination, filtering, or workflow behavior changes.

6. **Recommended migration order**
   - (a) High-traffic legacy wrappers and dense lists.
   - (b) Settings detail surfaces.
   - (c) Remaining modal/detail panel internals.
   - (d) Low-traffic legacy pages last.

## Modal/detail-panel token guidance (dialogs, drawers, and upload internals)

For modal/drawer/detail token cleanup PRs, use the rules below to keep risk low and UX consistent:

1. **Use `--dt-*` tokens only for presentation substitutions**
   - Surface/background: `--dt-surface`, `--dt-surface-raised`, `--dt-surface-muted`, `--dt-surface-subtle`, `--dt-bg-warm`
   - Text: `--dt-text`, `--dt-text-secondary`, `--dt-text-muted`, `--dt-text-disabled`, `--dt-text-inverse`
   - Borders: `--dt-border-whisper`, `--dt-border`, `--dt-border-strong`
   - Accent/focus: `--dt-accent`, `--dt-accent-hover`, `--dt-accent-subtle`, `--dt-focus`, `--dt-focus-ring`
   - Semantics: `--dt-success|warning|error|info` and subtle counterparts.

2. **Dialog semantic-state rules**
   - Destructive confirmations must retain explicit danger tone (`--dt-error` family).
   - Warning notices remain visually distinct from info and success.
   - Informational helper/metadata copy should use muted/secondary text, not danger/warning tones.
   - Disabled/read-only surfaces must remain readable (`--dt-text-disabled` only where appropriate).

3. **Behavior + focus management must remain unchanged during token cleanup**
   - Do not alter open/close sequencing, escape/overlay close behavior, focus trap logic, or keyboard shortcuts in modal/drawer components.
   - Token cleanup PRs are visual only; no workflow, validation, routing, or API coupling.

4. **Density and sizing guardrails**
   - Do not increase modal width, row heights, form spacing, or button sizes while applying tokens.
   - Preserve existing compact operational rhythm.

## Design-token QA rules

Use these rules for every token-adoption PR.

1. **Review approach for token-only PRs**
   - Review by diffing presentation changes only (colors, borders, focus rings, surfaces, typography tokens).
   - Validate against `docs/ui/visual-regression-checklist.md` before merge.
   - Require at least one dense-table route and one settings route QA pass.

2. **What must not change in token-only PRs**
   - No route changes, API changes, auth/RBAC changes, workflow/state-machine changes, or payload shape changes.
   - No CTA hierarchy rewrites unless required to fix a clear visual bug.
   - No spacing/density inflation that alters operational scan speed.

3. **Density preservation guardrails**
   - Keep table row heights, toolbar heights, and form rhythm consistent with current operational baseline.
   - Avoid adding extra vertical wrappers/padding around list and filter surfaces.
   - Treat “more whitespace” as a regression unless explicitly approved by product UX review.

4. **Semantic color review rules**
   - Preserve explicit success/warning/error/info distinctions with `--dt-*` semantic tokens.
   - Do not neutralize danger states or use accent blue for destructive actions.
   - Ensure semantic notices include supporting text/icon patterns where interaction-critical.

5. **Focus ring verification rules**
   - Keyboard `Tab` traversal must show an obvious focus style on primary actions, navigation links, table actions, and form controls.
   - Focus-visible treatment must remain consistent between platform shell and legacy high-traffic pages.
   - Modal focus trap must remain intact after token updates.

6. **Hardcoded color handling policy**
   - New code should not introduce raw hex/slate/gray utility colors for product app surfaces when a `--dt-*` token exists.
   - If a hardcoded color is found in touched files, replace it with the closest semantic token in the same PR when risk is low.
   - If replacement is risky or unclear, log a follow-up with exact file/path and intended token mapping.

## Table/list token contract addendum (April 27, 2026)

- Shared and platform table headers should use `--dt-surface-subtle` + `--dt-border-whisper` with muted uppercase header text.
- Row interaction states should rely on subtle surface shift (`--dt-surface-subtle`) for hover/focus-within, not decorative effects.
- Active filter chips attached to table/list toolbars should use pill radius + subtle token surfaces/borders (`--dt-surface-subtle`, `--dt-border-whisper`) with explicit remove affordance.
- Empty/loading/error table row states should remain compact, centered, and readable; retry actions stay present when previously supported.
- Density guardrail remains strict: no inflation of row height, cell padding, toolbar height, or pagination height in token-only table/list passes.

## Ongoing maintenance rules (added April 28, 2026)

To preserve modernization gains and prevent style regressions:

1. **Product-app UI must default to `--dt-*` tokens**
   - New firm-facing UI (authenticated app shell routes, admin, settings, CRM/CMS, worklists, dockets) should use existing `--dt-*` tokens for surfaces, borders, text, semantic states, and focus.

2. **Hardcoded product-app colors require explicit justification**
   - New raw hex or Tailwind hardcoded semantic colors in product-app surfaces should be avoided when an equivalent `--dt-*` token exists.
   - If a hardcoded value is intentionally kept, include a short inline comment or PR note with rationale and intended future token mapping.

3. **Focus-visible consistency is mandatory**
   - New interactive controls should expose a clear, keyboard-visible focus treatment that aligns with `--dt-focus` / `--dt-focus-ring`.

4. **Legacy compatibility classes should be isolated, not expanded**
   - Existing transitional `neo-*` usage may remain temporarily where migration risk exists.
   - Do not add new `neo-*` classes in product-app code; migrate touched surfaces toward shared modern primitives.

5. **Marketing/public surfaces may use a separate visual system only when documented**
   - Public marketing/landing/upload visual variants are allowed only when explicitly scoped and documented as non-product-app design language.
   - Shared product components should not inherit marketing-specific tokens unless intentionally adapted and documented.

6. **Token-only PR constraints remain strict**
   - Styling cleanup PRs must remain presentation-only: no API, routing, RBAC/auth, workflow, storage/BYOS/BYOAI, or payload behavior changes.
