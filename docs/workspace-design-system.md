# Docketra Workspace Design System

This document defines layout rules, design primitives, product language, and component usage guidelines for the Docketra authenticated workspace.

---

## Product Language

Use the following user-facing labels. Internal route segments (`/crm`, `/cms`, `/admin`) may remain unchanged, but visible UI copy must use the product language.

| User-facing label  | Internal route        | Nav section      |
|--------------------|-----------------------|------------------|
| Work               | `/task-manager`       | Daily Operations |
| Dashboard          | `/dashboard`          | Daily Operations |
| Knowledge Intake   | `/cms`                | Firm Memory      |
| Relationships      | `/crm`                | Firm Memory      |
| Company Brain      | `/company-brain`      | Firm Memory      |
| Knowledge Library  | `/knowledge`          | Firm Memory      |
| Clients            | `/clients`            | Firm Memory      |
| Reports            | `/admin/reports`      | Oversight        |
| Team & Access      | `/admin`              | Administration   |
| Settings           | `/settings`           | Administration   |

**Rules:**
- Do NOT use "CRM", "CMS" as primary navigation labels.
- Do NOT say "Docketra Legal Solutions" — Docketra is not exclusively a legal product.
- Do NOT introduce fake billing, upgrade, or pro-tier cards unless those routes exist and work.
- Company Brain is **read-only**. Do not add write operations, AI, vector search, or new backend calls to it.

---

## App Shell

The workspace uses a single shared shell: **`PlatformShell`** (`src/components/platform/PlatformShell.jsx`).

### Do
- All authenticated firm workspace pages must render `<PlatformShell>` as the root wrapper.
- Pass `title`, `subtitle`, and optionally `moduleLabel` and `actions` to `PlatformShell`.

### Don't
- Don't use the legacy `<Layout>` component in new workspace pages.
- Don't nest `PlatformShell` inside another shell.

### Props

```jsx
<PlatformShell
  moduleLabel="Daily Operations"   // optional section label shown in topbar
  title="Dashboard"                // required — sets page title and browser tab
  subtitle="Short description."    // optional — rendered below title in topbar
  actions={<Link to="...">New Docket</Link>}  // optional — rendered in topbar right
>
  {/* page content */}
</PlatformShell>
```

---

## Sidebar Navigation

The sidebar is defined in `src/constants/platformNavigation.js`.

### Grouping

```
Daily Operations
  Work           → /task-manager
  Dashboard      → /dashboard

Firm Memory
  Knowledge Intake  → /cms
  Relationships     → /crm
  Company Brain     → /company-brain
  Knowledge Library → /knowledge
  Clients           → /clients

Oversight
  Reports        → /admin/reports

Administration
  Team & Access  → /admin
  Settings       → /settings
```

### Active state rules

Active highlighting uses `isNavItemActive()` from `src/utils/navActive.js`.

- Most items use `exactOrDescendant` match.
- Team & Access excludes `/admin/reports` so Reports stays highlighted when on report pages.
- Only one item should be active at a time.

### Collapsed sidebar

When collapsed (compact rail), the sidebar shows only icons and keeps route access unchanged. Labels and section titles are hidden, but links must keep accessible labels/tooltips. Collapse is toggled via the chevron button in the brand block. Keep focus-visible and aria-current behavior unchanged.

---

## Topbar

The topbar is sticky at `top: 0`, `z-index: 30`, and should stay compact but readable on 1366/1024 widths. It contains a strict hierarchy:

1. Left rail (context): `moduleLabel`, `title`, optional `subtitle`, and concise breadcrumbs when nested context is helpful.
2. Right rail (actions): command/search trigger, page actions, storage badge, and user menu.

### Breadcrumbs
- Keep breadcrumbs quiet and contextual; avoid generic `Workspace / <Page>` on landing pages.
- Show breadcrumbs when they add orientation value (detail/nested pages).
- Preserve breadcrumb accessibility labeling.

### Action rail
- Keep action controls aligned to common control height and spacing rhythm.
- Command trigger should read as search/command entry, not a generic button.
- Page-specific actions should remain visually primary relative to status chrome.
- Storage badge must remain visible but low-emphasis compared with page actions.

### Responsive shell behavior
- 1366px: no topbar overflow, title and command trigger remain readable.
- 1024px: action rail may wrap, but command trigger and account menu must remain visible.
- Mobile: keep essential actions reachable and preserve sidebar navigation usability without route/permission changes.

---

## Page Header Pattern

Use the `title` and `subtitle` props of `PlatformShell` for the main page heading. Do not add a separate `<h1>` inside the page content unless the content requires a secondary heading level.

For secondary content sections, use `<PageSection>`:

```jsx
<PageSection
  title="Section title"
  description="Short description of this section."
  actions={<Link to="...">CTA</Link>}
>
  {/* section content */}
</PageSection>
```

---

## Metric Cards (StatGrid)

Use `<StatGrid>` for KPI strip panels. Each card shows a label (uppercase), a large numeric value, and optional help text.

```jsx
<StatGrid
  items={[
    { label: 'Total dockets', value: 42, helpText: 'All dockets across the firm.' },
    { label: 'In progress',   value: 7,  helpText: 'Active execution work.' },
  ]}
/>
```

**Rules:**
- Always show real data from the API. Use `'…'` as loading placeholder.
- Do not hardcode fake numbers.
- Keep labels short (≤ 3 words).

### Dashboard command-center rules

- The Dashboard must answer: **what needs attention now**, **current workload/health**, and **where to go next**.
- Keep dashboard KPI cards compact with **4–6 max** and source them only from existing backend metrics.
- Do not add fake metrics, fake counts, or synthetic activity feed items.
- Keep quick actions focused on daily operations only (New Docket, My Worklist, Workbaskets, QC Worklist, All Dockets; include Clients/Settings only when role access applies).
- Avoid generic module-launchpad sections that duplicate sidebar navigation.

---


## Queue Workspace Layout (Workbaskets / My Worklist / QC Worklist)

Use a consistent operational layout on queue-heavy pages:

1. **Status message stack (optional)**
   - Show API failures, background refresh notices, and action success messages.
   - Avoid duplicate top-level + table-level error messages.

2. **Queue summary strip**
   - Use `StatGrid` for 3–5 compact KPIs.
   - Use only real data; while loading, render `'…'` placeholders.

3. **Operational filter toolbar**
   - Use `FilterBar` for search + queue filters.
   - Include a clear filters action and a visible refresh action.
   - Controls must include accessible labels (`aria-label`) and active filters must not rely on color only.

4. **Queue table**
   - Use `DataTable` from `PlatformShared.jsx` with `compact` density for high-traffic queues.
   - Prefer column order: Docket ID, Client, Category/Subcategory, Status, Owner/Queue, Due/Updated, Actions.
   - Use `StatusBadge` for statuses and compact grouped row actions.

5. **Empty / loading / error language**
   - Use queue-specific copy for empty states.
   - Distinguish unfiltered empty states from filtered empty states with `emptyLabel` + `emptyLabelFiltered`.
   - Provide one clear retry path when table data fails.

6. **Row action hierarchy**
   - Keep row actions compact and execution-focused by queue type.
   - My Worklist: execution actions (Send to QC, Pend, Resolve).
   - QC Worklist: review actions (Pass, Send back/Correct, Fail).
   - Oversight views like All Dockets should remain list/search-first (Open/detail), not pull-queue language.


## Legacy UI cleanup rules

- PlatformShell owns each page title/subtitle; do not duplicate that metadata with PageHeader inside PlatformShell page content.
- Prefer platform layout primitives (`platform-page`, `section-group`, `PageSection`, `form-split`, `settings-form-split`, `action-row`, `settings-action-bar`) over page-level wrapper utilities.
- Avoid duplicate PageHeader usage in active PlatformShell pages unless explicitly deferred and documented.
- Do not use inline layout spacing (`style={{ margin... }}`, `style={{ padding... }}`) in active workspace pages.
- Remove dead UI code only after confirming route reachability, import usage, and test coverage safety.

## DataTable

Use `<DataTable>` from `PlatformShared.jsx` for all tabular data.

```jsx
<DataTable
  columns={['ID', 'Name', 'Status', 'Created']}
  rows={visibleRows}   // array of <tr> elements
  loading={isLoading}
  error={errorMessage}
  onRetry={refetch}
  emptyLabel="No dockets found."
  emptyLabelFiltered="No dockets match the current filters."
  hasActiveFilters={hasActiveFilters}
  pageSize={25}
/>
```

**Rules:**
- Always provide `emptyLabel` and `loading`.
- Use `emptyLabelFiltered` when filters are active.
- Use `onRetry` when an API error occurs.
- Avoid horizontal overflow on standard 1440px laptop screens. Use `table-layout: fixed` and sensible column widths.

---

## Status Badge

```jsx
import { StatusBadge } from './PlatformShared';

<StatusBadge status="in_progress" />
<StatusBadge status="resolved" />
<StatusBadge status="draft" />
```

Supported status values: `open`, `in_progress`, `active`, `draft`, `pending`, `review`, `pended`, `escalated`, `qc_failed`, `resolved`, `closed`, `filed`, `archived`.

---

## Priority Badge

```jsx
import { PriorityBadge } from './PlatformShared';

<PriorityBadge priority="high" />
<PriorityBadge priority="medium" />
```

Supported values: `critical`, `high`, `medium`, `low`.

---

## Empty State

```jsx
import { EmptyState } from './PlatformShared';

<EmptyState
  title="No clients yet"
  body="Add your first client to get started."
  actionLabel="Add client"
  onAction={() => setShowModal(true)}
/>
```

Use `EmptyState` inside tables, panels, and page sections when there is no data. Always include a helpful `body` and an actionable CTA when a recovery action is available.

---

## Loading State

```jsx
import { LoadingState } from './PlatformShared';

{isLoading ? <LoadingState label="Loading clients…" /> : null}
```

---

## Error State

```jsx
import { ErrorState } from './PlatformShared';

{isError ? (
  <ErrorState
    title="Could not load clients"
    body="There was a problem fetching client records. Please try again."
    actionLabel="Retry"
    onAction={refetch}
  />
) : null}
```

---

## Filter Bar

```jsx
import { FilterBar } from './PlatformShared';

<FilterBar onClear={handleClear} clearDisabled={!hasFilters}>
  <input
    type="search"
    placeholder="Search by name…"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
  />
  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
    <option value="">All statuses</option>
    <option value="active">Active</option>
  </select>
</FilterBar>
```

---

## Typography

| Usage        | Size    | Weight | Class          |
|--------------|---------|--------|----------------|
| Page title   | 15px    | 650    | (topbar h1)    |
| Section title| 14px    | 650    | `.section-title` |
| KPI value    | 26px    | 700    | `.kpi`           |
| Metric label | 10.5px  | 700    | `.metric-label`  |
| Body / muted | 12px    | 400    | `.muted`         |
| Badge        | 11px    | 600    | `.status-badge`  |

---

## Color Tokens (key subset)

| Token                  | Usage                      |
|------------------------|----------------------------|
| `--dt-accent`          | Primary blue (#225fe0)     |
| `--dt-accent-subtle`   | Light blue bg (#e9f0ff)    |
| `--dt-text`            | Main text (#191917)        |
| `--dt-text-muted`      | Muted/secondary text       |
| `--dt-surface`         | Card / panel background    |
| `--dt-surface-subtle`  | Table row hover, input bg  |
| `--dt-border-whisper`  | Subtle borders             |
| `--dt-error`           | Red, error state           |
| `--dt-success`         | Green, success state       |
| `--dt-warning`         | Amber, warning state       |

---

## Responsive Behavior

| Breakpoint | Behavior                                              |
|------------|-------------------------------------------------------|
| ≥ 1025px   | Full sidebar (240px) with labels and section titles   |
| 769–1024px | Compact sidebar (56px) with icons only, no labels     |
| ≤ 768px    | Sidebar collapses to horizontal nav strip at the top  |

---

## Storage Messaging

When displaying storage context:
- If the firm uses BYOS (Bring Your Own Storage), display: *"Files stored in your firm-provided cloud storage."*
- If using Docketra-managed storage, display: *"Files stored in Docketra-managed secure storage."*
- Do not say "BYOD" or confuse it with BYOS.

---

## When to Use Internal Route Names vs. User-Facing Labels

| Context                     | Use                          |
|-----------------------------|------------------------------|
| `<Link to={ROUTES.CRM(s)}>` | Internal route constant      |
| Nav link label              | "Relationships"              |
| Breadcrumb                  | "Relationships"              |
| Page title                  | "Relationships"              |
| `path="crm"` in Router      | Internal route segment (ok)  |
| Button label                | "Add relationship" not "Add CRM record" |
| Docs / error messages       | Use product language         |

**Rule of thumb:** Routes, JS constants, and internal identifiers may keep legacy names. Anything the user reads must follow the product language defined in this document.


## Layout Foundation Primitives

Use these reusable classes for consistent workspace composition:

- `.platform-page` / `.platform-page--narrow`: content-width containers.
- `.section-group`: vertical grouping for related sections.
- `.layout-two-col`: balanced two-column layout.
- `.layout-two-by-two`: balanced 2x2 card grid.
- `.card-deck`: equal-height cards.
- `.form-split`: left descriptive metadata + right form/card content.
- `.action-row` and `.action-row--tight`: normalized action button/link rows.
- `.secondary-link`: consistent secondary action links.
- `.table-wrap--compact`: compact, readable operational table density.

Use `PageSection` variants to control section density:
- `variant="default"`: standard panel section.
- `variant="compact"`: tighter spacing for utility panels.
- `variant="split"`: adds visual separation in section headers.
- `variant="flush"`: removes panel chrome for nested layouts.

Avoid inline spacing/layout styles on platform pages when these primitives apply.

## Admin and settings control-center layout rules (PR 4)
- Keep the Settings hub as a 2x2 module grid with clear route ownership for Firm profile, Work settings, Team & controls, and Storage & AI.
- For settings detail pages, prefer a form-split layout: left side for section purpose, policy notes, and scope; right side for controls, tables, and actions.
- Use one status stack near the page header for save/load/background notices; avoid duplicate error banners for the same failure.
- Keep save/action hierarchy consistent: primary save first, then secondary reset/cancel/test actions in a compact action bar.
- Use compact admin tables and scannable labels for team/role/access surfaces; keep destructive actions visually secondary until confirmed.
- Storage and AI messaging must stay trust-oriented and safe: do not expose raw credentials, tokens, drive IDs, or API key values in the UI.
