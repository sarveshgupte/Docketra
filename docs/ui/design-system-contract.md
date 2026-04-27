# Docketra UI Design System Contract

## Purpose

This contract defines the shared UI foundation for operational Docketra surfaces. The target is professional B2B SaaS usability: clear hierarchy, high signal density, predictable interactions, and low visual noise.

## Design language foundation (April 26, 2026)

- Docketra uses a warm-professional light theme token set (`--dt-*`) as the shared visual source of truth for app surfaces.
- Implementation focus is intentionally limited to shared primitives and shell surfaces in this foundation pass.
- Product behavior, API contracts, routing, and RBAC rules are unchanged by design-language changes.

### Token groups

- **Surface/background:** `--dt-bg`, `--dt-bg-warm`, `--dt-surface`, `--dt-surface-raised`, `--dt-surface-muted`, `--dt-surface-subtle`
- **Text:** `--dt-text`, `--dt-text-secondary`, `--dt-text-muted`, `--dt-text-disabled`, `--dt-text-inverse`
- **Border:** `--dt-border-whisper`, `--dt-border`, `--dt-border-strong`
- **Accent/focus:** `--dt-accent`, `--dt-accent-hover`, `--dt-accent-active`, `--dt-accent-subtle`, `--dt-focus`, `--dt-focus-ring`
- **Semantic:** `--dt-success`, `--dt-warning`, `--dt-error`, `--dt-info` + subtle counterparts
- **Radius/shadow/typography:** `--dt-radius-*`, `--dt-shadow-*`, `--dt-font-*`

### Component alignment in this phase

- Button, Card, Badge, Input, Select, Textarea, EmptyState, Modal, PageHeader, shared Table/DataTable surfaces, and `platform.css` operational shell styles now consume Docketra tokens.
- Existing component APIs remain stable (variant names, size aliases, modal sizing aliases, table row interaction hooks).
- Density is kept operational (compact controls and table rows, no marketing-style spacing expansion).

## Core principles

- Prefer shared components in `ui/src/components/common` and `ui/src/components/layout` before page-level custom markup.
- Keep interaction behavior consistent across modules (CRM, CMS, Task Manager, Admin).
- Favor readable defaults over decorative styling.
- Maintain backwards compatibility for existing calling code where possible.

## Component API contract

### Button (`common/Button.jsx`)

- **Allowed variants:** `primary`, `secondary`, `outline`, `danger`, `ghost`.
- **Backward-compatible variant aliases:** `default -> secondary`, `warning -> danger`.
- **Allowed sizes:** `xs`, `sm`, `md`, `lg`.
- **Backward-compatible size aliases:** `small -> sm`, `medium -> md`, `large -> lg`.
- `className` is intentionally layout-sanitized (margin/flex positioning utilities only) to prevent inconsistent ad-hoc styling drift.
- If a caller intentionally needs full utility control, use `allowUnsafeClassName`.

### Input / Select

- Use shared `formClasses` from `ui/src/theme/tokens.js` for border, focus, error, success, help text.
- Required fields must use `required` and preserve `aria-*` validation metadata.
- Read-only values should render as non-editable text (Input supports this directly).

### Card

- Use `Card`, `CardHeader`, `CardBody`, `CardFooter` instead of page-local panel wrappers.
- Interactive cards should set `interactive` or `onClick` for consistent hover semantics.

### DataTable

- Prefer `DataTable` + `Table` primitives over custom tables for operational lists.
- Keep row interaction accessible (`tabIndex`, keyboard Enter/Space activation).
- Use consistent states:
  - loading (`loading`, `loadingMessage`)
  - recoverable error (`errorMessage`, `onRetry`)
  - empty (`emptyMessage`)
  - filtered-empty (`emptyFilteredMessage`)
  - background refresh (`refreshingMessage`)

### EmptyState / ErrorState

- Use shared states for first-use empty and recoverable failures.
- Keep action copy direct and task-oriented.

### PageHeader

- Use shared title/subtitle/actions structure.
- Keep max-width constrained description copy for scanability.

### Modal

- Use shared modal shell for focus trapping, escape close, overlay close, and keyboard primary action support.
- **Allowed sizes:** `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`.
- **Backward-compatible aliases:** `small`, `medium`, `large`.

### Tabs

- Tabs must be keyboard navigable and URL-addressable where the surface requires deep linking.

### Toasts

- Use `ToastProvider` context and typed feedback (`success`, `warning`, `info`, `danger`/`error`).
- Toast copy should be short and operationally meaningful.

## Spacing and density

- Form controls default to compact-operational sizing (`min-h-11`) for readability.
- Secondary utility actions in tables/filters should use `Button size="sm"` or `size="xs"`.
- Prefer `space-y-*` or shared spacing tokens over one-off inline style margins.

## Legacy style migration policy

- Legacy `neo-*` classes should not be added to active app surfaces.
- When touching a surface for feature work or bug fixes, migrate nearby `neo-*` utility usage to shared modern utilities/components.
- Avoid broad page rewrites in one pass; prioritize shared foundation and high-traffic surfaces first.

## Implementation checklist (for future UI changes)

1. Reuse shared component first.
2. Validate component props align with this contract (variant, size, state model).
3. Ensure loading/error/empty are explicitly handled.
4. Avoid introducing new visual language unless required.
5. Add or update a lightweight regression test when possible (`ui/tests/*.test.mjs`).
