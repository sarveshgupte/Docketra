# Docketra Table/List UX Contract (April 27, 2026)

## Scope

This contract standardizes table/list presentation across shared primitives and high-traffic operational surfaces while preserving existing data contracts and interaction logic.

## Audit summary (current state)

### Shared implementations

- `ui/src/components/common/DataTable.jsx` is used by All Dockets (`CasesPage`), Workbasket, admin sections, dashboard tables, CRM leads/clients pages, and legacy client listing surfaces.
- `ui/src/pages/platform/PlatformShared.jsx` exposes platform `.table` + `.table-wrap` DataTable used by My Worklist, Workbench, QC Workbench, CRM dashboard sections, CMS intake queue, reports, and CRM client detail tables.
- `ui/src/components/common/Table.jsx` is the low-level primitive used by `ui/src/components/common/DataTable.jsx`.

### Pattern differences observed

- Active filter chips were tokenized in common DataTable but QC queue used custom slate classes.
- Empty/loading/error row messaging had slightly different spacing and aria status signaling between common and platform DataTable implementations.
- Pagination wrappers used different visual framing and spacing.
- Row hover/focus styling differed between platform `.table` and common `Table` rows.
- Retry CTA labels existed but lacked fully consistent assistive labels.

## UX contract

### 1) Density rules
- Preserve compact operational density.
- Do not increase existing row/cell paddings on platform `.table` (`8px 10px`) and preserve dense mode in common DataTable (`px-4 py-2.5`).

### 2) Row height / padding
- Common DataTable keeps current dense/default padding behavior.
- Platform `.table th/.td` paddings remain unchanged.

### 3) Header styling
- Tokenized sticky headers with `--dt-surface-subtle`, `--dt-border-whisper`, and muted uppercase text.

### 4) Text hierarchy
- Header text: compact uppercase muted label.
- Cell text: primary text token with right alignment only when required by column semantics.

### 5) Status/badge placement
- Keep status indicators in cells and not in standalone decorative wrappers.
- Preserve existing semantic color meanings (success/warning/error/info).

### 6) Row action placement
- Actions stay in right-most action cells and grouped with compact spacing.
- No behavior changes to action handlers.

### 7) Empty state rules
- Empty row copy remains centered and compact.
- Filtered empty states must use filtered copy where filters are active.

### 8) Loading state rules
- Loading row/table wrappers use polite `aria-live` status announcements.
- Keep loading message placement inside table wrapper.

### 9) Error/retry rules
- Error rows use `--dt-error` text and preserve retry CTA where previously available.
- Retry actions should include clear labels for assistive tech.

### 10) Active filter chip rules
- Filter chips use `--dt-*` surfaces/borders/text and pill radius.
- Remove-filter affordance uses compact close glyph.
- Clear-all control remains visible when filters exist.

### 11) Pagination rules
- Pagination stays at table footer with compact spacing.
- Use explicit navigation labels and maintain existing previous/next behavior.

### 12) Responsive overflow rules
- Preserve horizontal overflow via `.table-wrap` and primitive `overflow-x-auto` wrappers.
- Do not introduce fixed widths that break dense operations.

### 13) Keyboard/focus rules
- Maintain semantic table headers and existing `aria-sort` behavior.
- Clickable rows keep Enter/Space activation behavior.
- Focus-visible styles are clear, tokenized, and non-noisy.

### 14) Implementation selection
- Use `common/DataTable` for app surfaces that require sortable columns, row click behavior, active filter chips, and custom cell renderers.
- Use `PlatformShared.DataTable` for platform shell module sections already structured around `.table` rows markup.
- Use raw platform `.table` markup only for lightweight module-local tabular rendering already inside platform section contracts.

### 15) Migration plan for local/custom tables
1. Keep existing behavior and data contracts unchanged.
2. Token-align local custom table wrappers to `--dt-*` table contract.
3. Add filtered-empty + retry parity where missing.
4. Migrate one module at a time (queues first, then CRM/CMS/admin/settings detail lists).
5. Validate with visual checklist before broader convergence.

## Remaining gaps

- CRM leads/clients filter forms still include some non-token utility classes around controls.
- Additional local custom list/table-like cards outside high-traffic routes remain to be normalized incrementally.
