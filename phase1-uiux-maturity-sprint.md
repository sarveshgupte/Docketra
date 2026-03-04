# Phase 1 UI/UX Maturity Sprint (Docketra)

## 1️⃣ Action Hierarchy Standardization

### Inconsistencies to resolve
- Primary actions shift location across pages (sometimes in top-right header, sometimes inside card footers).
- Multiple “high-emphasis” buttons appear together (e.g., `Save`, `Save & Close`, `Submit`) without a clear dominant action.
- List pages mix page-level and row-level primaries, causing visual noise and decision friction.

### Unified action hierarchy pattern

#### List pages
- **Primary CTA (1 max):** top-right in `PageHeader` (`+ New Matter`, `+ Add Client`).
- **Secondary actions:** outlined buttons adjacent to primary (e.g., `Export`, `Bulk Actions`).
- **Tertiary actions:** icon or text buttons in table toolbar or kebab menu.
- **Row-level actions:** never primary filled style; use ghost/text + overflow menu.

#### Detail pages
- **Primary CTA (1 max):** top-right in `PageHeader` (`Edit`, `Save Changes` in edit mode).
- **Critical destructive actions:** isolated in overflow menu or danger section, never adjacent to primary.
- **Supporting actions:** `Back`, `Print`, `View Timeline` as secondary/ghost.

#### Form pages
- **Context-aware footer action bar (desktop):**
  - Sticky only when page content exceeds viewport height; otherwise render as static footer.
  - Left: persisted status (`● Draft saved • 12:42 IST`).
  - Right: `Cancel` (ghost), `Save Draft` (secondary), `Save & Continue` or `Submit` (primary).
- Only one filled primary at any time.

### Exact UI rule set
1. One filled primary button per view region (header or footer) at a time.
2. Secondary buttons use `variant="outline"`; tertiary uses `variant="ghost"` or text.
3. Destructive actions use explicit danger styling and require confirmation.
4. Button order (LTR): **least risky → most committed**.
5. Header actions must remain in a consistent right-aligned cluster with fixed spacing.

### Example JSX (using existing `Button` + `PageHeader`)

```jsx
<PageHeader
  title="Matters"
  subtitle="Track all active and closed legal matters"
  actions={
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm">Export</Button>
      <Button variant="outline" size="sm">Bulk Actions</Button>
      <Button size="sm">+ New Matter</Button>
    </div>
  }
/>
```

```jsx
<div className={cn(
  "border-t bg-white px-6 py-3",
  isScrollablePage && "sticky bottom-0"
)}>
  <div className="flex items-center justify-between">
    <p className={cn("text-xs", isRecentlySaved ? "text-emerald-600" : "text-slate-500")}>
      <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", isRecentlySaved ? "bg-emerald-500" : "bg-slate-400")} />
      Draft saved • 12:42 IST
    </p>
    <div className="flex items-center gap-2">
      <Button variant="ghost">Cancel</Button>
      <Button variant="outline">Save Draft</Button>
      <Button>Save & Continue</Button>
    </div>
  </div>
</div>
```

### Tailwind spacing normalization
- Header horizontal paddings: `px-6`.
- Action cluster gap: `gap-2` (buttons), `gap-3` (header text blocks).
- Section-to-section spacing: `space-y-6` on desktop pages.
- In-card content rhythm: `space-y-4`.
- Form row vertical spacing: `gap-y-4`, dense mode `gap-y-3`.

---

## 2️⃣ Data Table Professionalization (Without New Libraries)

### Scope focus
- Sortable headers
- Compact toolbar
- Clear filter reset
- Higher metadata density

### `DataTable` prop extension plan (incremental)

```ts
type SortDirection = 'asc' | 'desc';

type SortState = {
  key: string;
  direction: SortDirection;
};

type ActiveFilter = {
  key: string;
  label: string;
  value: string;
};

type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: T[];
  sortState?: SortState;
  onSortChange?: (next: SortState) => void;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (key: string) => void;
  onResetFilters?: () => void;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  dense?: boolean;
};
```

### Sort state pattern
- Default sort is always pre-applied (recommended: `updatedAt desc` on legal operational lists).
- Click cycle for sortable column: `asc <-> desc` (no null/unsorted state).
- Show inline icon state:
  - active asc: `↑`
  - active desc: `↓`
  - inactive sortable column: muted `↕` only before first activation on non-default columns.
- Date columns should initialize as `desc` to match legal recency workflows.
- Keep unsorted state disabled unless a module has a regulatory requirement to preserve backend order.

### Example logic

```ts
const nextSortDirection = (current: SortDirection): SortDirection =>
  current === 'asc' ? 'desc' : 'asc';
```

- Persist sort in URL query when possible (`?sort=updatedAt&dir=desc`) for deterministic revisit behavior.

### Compact toolbar pattern
- Single-line desktop toolbar (`h-10`) above table:
  - Left: search input, status dropdown.
  - Right: active filter chips, `Reset` text button, optional export.
- No stacked controls unless viewport constraint forces wrap.

### Filter chip pattern (minimal)
- Chip format: `Status: Active ×`.
- Use low-emphasis neutral surface (`bg-slate-100 text-slate-700`).
- Global clear always visible when `activeFilters.length > 0`.

```jsx
<div className="flex items-center gap-2">
  {activeFilters.map((f) => (
    <button
      key={f.key}
      onClick={() => onRemoveFilter?.(f.key)}
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
    >
      {f.label}: {f.value} <span aria-hidden>×</span>
    </button>
  ))}
  <Button variant="ghost" size="sm" onClick={onResetFilters}>Reset filters</Button>
</div>
```

### Estimated complexity
- Sortable headers + state plumbing: **1.5–2 days**.
- Toolbar and chip integration: **1 day**.
- Query-param persistence + polish: **0.5–1 day**.
- Total: **~3–4 developer days**.

---

## 3️⃣ Deterministic Action Feedback System

### UI state flow (for every mutating action)
1. **Idle:** Button enabled, explicit label (`Save Changes`).
2. **Processing:** Button disabled + spinner + verb in-progress (`Saving...`).
3. **Success:** Toast + inline persisted indicator (`● Draft saved • 14:32 IST`) in success accent for 4–6 seconds, then fade to neutral metadata.
4. **Error:** Inline field/global message + retry affordance.
5. **Next Step:** Provide deterministic continuation (`View Matter`, `Continue Editing`).

### Toast + inline feedback pattern
- **Toast:** short-lived confirmation (2.5–4s), top-right desktop.
- **Inline persistent feedback:** near section header or form footer for audit confidence.
- **Persisted signal behavior:** green dot + success tone immediately after save, transitions to neutral text state without disappearing.
- For critical actions (filing, closure), include immutable reference ID in success copy.

### Example button loading state

```jsx
<Button disabled={isSaving} onClick={handleSave}>
  {isSaving ? (
    <span className="inline-flex items-center gap-2">
      <Spinner className="h-4 w-4" />
      Saving...
    </span>
  ) : (
    'Save Changes'
  )}
</Button>
```

### Confirmation copy guidelines
- Use explicit domain object + outcome.
  - Good: `Matter MTR-2024-018 has been updated.`
  - Better: `Matter MTR-2024-018 updated at 14:32 IST by Priya S.`
- Avoid ambiguous confirmations like `Done` or `Success` alone.
- Error copy should include action + impact + recovery.
  - `Could not save billing terms. No changes were applied. Retry or contact admin.`

---

## 4️⃣ Timestamp & Metadata Standardization

### Universal rules
- Default format (India context): `DD MMM YYYY, hh:mm A` + timezone abbreviation.
  - Example: `06 Feb 2026, 02:35 PM IST`.
- Always show actor with update metadata where available:
  - `Updated by Amit R. on 06 Feb 2026, 02:35 PM IST`.
- Relative time can be supplementary, never sole source:
  - `2h ago` + absolute timestamp on hover or adjacent.

### Formatter utility structure

```ts
// utils/formatDateTime.ts
export const formatDateTime = (input: string | Date, opts?: { withTZ?: boolean }) => {
  // Intl.DateTimeFormat with en-IN locale
};

export const formatRelativeTime = (input: string | Date) => {
  // "2h ago", "3d ago"
};

export const formatAuditStamp = ({ user, timestamp }: { user?: string; timestamp?: string }) => {
  // "Updated by {user} on {formatted}"
};
```

### Placement rules
- **List row:** compact metadata line under primary identifier.
  - `Updated by Neha K. • 06 Feb 2026, 02:35 PM IST`.
- **Detail header:** right-side metadata block with last updated + created + last action.
- **Forms:** footer autosave + last persisted timestamp.

### “Last action” + freshness indicators
- Add `Last action: Hearing date changed by ...` near detail header metadata.
- For stale data-sensitive modules, show freshness chip:
  - `Synced 3m ago` (neutral)
  - `Sync delayed` (warning)

### Copy consistency
- Use fixed prefixes: `Created`, `Updated`, `Last action`, `Synced`.
- Keep tense consistent (`updated`, `created`) and avoid mixed capitalization.

---

## 5️⃣ Lightweight Audit Visibility (Trust Upgrade)

### Mini audit metadata in case list rows
- Add a muted second line under each matter title:
  - `Last action: Stage updated • by Priya S. • 06 Feb 2026, 02:35 PM IST`.
- Density guardrail for high-volume tables:
  - Default table view: show compact/truncated audit snippet.
  - Show full audit line on row hover or explicit expanded row state.
  - Keep full detail always visible in row drawer/modal (`View Timeline`).

### Quick “View Timeline” action
- Add tertiary action in row overflow and detail header.
- Open right-side drawer (preferred desktop) or modal fallback.
- Drawer content:
  - Latest 10 events (timestamp, actor, action, reference).
  - Link to full audit trail page if available.

### Immutability cues
- Use lock/check icon + text `Audit log is system-recorded`.
- Non-editable visual treatment for timeline rows (no inline edit affordances).
- Show source tags where relevant: `System`, `User`, `Integration`.

### Minimal professional density pattern
- Row metadata text size `text-xs`, color `text-slate-500`.
- Timeline rows: `py-2`, divider lines, timestamp right-aligned in monospace/tabular numerals.
- Avoid color-heavy status pills; reserve color for risk/warning events only.

---

## 6️⃣ Visual Rhythm & Density Tightening

### Exact spacing rules
- Page shell: `px-6 py-5`.
- Header to first content block: `mt-4`.
- Section blocks: `space-y-6`.
- Cards: `rounded-lg border p-4` (dense) or `p-5` (default), internal `space-y-4`.
- Table cell vertical padding: `py-2.5` for dense enterprise rhythm.

### Typography emphasis rules
- Section title: `text-sm font-semibold text-slate-900`.
- Field label: `text-xs font-medium uppercase tracking-wide text-slate-600` (use sparingly for metadata panels).
- Primary body: `text-sm text-slate-800`.
- Metadata/supporting text: `text-xs text-slate-500`.

### Tailwind-level refinements
- Standardize borders: `border-slate-200`.
- Reduce visual noise: avoid shadows except elevated overlays.
- Improve scanability with tabular numbers for dates/amounts:
  - `className="tabular-nums"` on metadata and numeric columns.
- Increase row hover confidence subtly: `hover:bg-slate-50` (no animated transitions required).

---

## If Docketra implements ONLY these 5 Phase 1 upgrades, the perceived product maturity will increase in these specific ways:

1. **Higher operational trust during daily case handling** through deterministic actions, explicit outcomes, and visible next steps (fewer “did it save?” moments).
2. **Stronger compliance confidence** by making timestamps, actors, and last actions consistently visible across lists and detail views.
3. **Faster desktop decision-making** due to denser, sortable, and filter-clear tables that reduce cognitive load for high-volume legal operations.
4. **More enterprise-grade visual discipline** via consistent action hierarchy, spacing rhythm, and restrained styling aligned with risk-averse professional users.
5. **Reduced perceived product risk in evaluations and demos** because audit visibility and immutability cues signal reliability, traceability, and governance readiness.
