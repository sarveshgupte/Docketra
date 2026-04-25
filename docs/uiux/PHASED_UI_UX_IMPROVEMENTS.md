# Docketra UI/UX Review & Phase-wise Improvement Plan (April 2026)

## Review snapshot

This plan is based on a code-level audit of the active UI stack in `ui/src` with emphasis on consistency, usability, accessibility, and perceived performance.

Key findings from the current implementation:

1. **Mixed UI patterns and component duplication**
   - Multiple `EmptyState` implementations exist (`components/EmptyState.jsx`, `components/ui/EmptyState.jsx`, and layout re-export), which can produce inconsistent visual and interaction behavior across pages.
   - Parallel style systems are in use (Tailwind utility classes, enterprise CSS blocks, and legacy `neo-*` class usage), making page-level consistency and maintenance harder.

2. **Inconsistent action and table behaviors across work views**
   - `CasesPage` and `WorklistPage` rely on shared `DataTable` and richer sorting/filter affordances.
   - `WorkbasketPage` still uses custom table and browser `confirm()` dialogs for key operations (`pull`/`bulk pull`), creating a different interaction model from the rest of the app.

3. **Route and auth-entry complexity creates fragmented first-run UX**
   - There are separate login entry paths (`LoginPage` and `FirmLoginPage`) with different copy and flow patterns.
   - Routing is split across `PublicRoutes`, `ProtectedRoutes`, and `LegacyRoutes`; this preserves compatibility, but it can also increase navigation variance and onboarding friction.

4. **Design token model is partially consolidated**
   - `ui/src/theme/tokens.js` defines utility tokens/classes used in modern components.
   - `ui/src/lib/designTokens.js` contains overlapping token definitions.
   - `ui/src/styles/tokens.css` is a compatibility bridge, indicating a migration in progress.

---

## Phase 1 (Weeks 1–2): Visual Consistency & Fast UX Wins

### Goals
- Eliminate obvious cross-page inconsistency.
- Improve clarity of actions and forms with minimal risk.

### Improvements
1. **Standardize “top actions” in page headers**
   - Adopt a strict single-primary CTA pattern for every page header.
   - Move secondary actions to `outline`/`ghost` variants.
   - Apply first to `CasesPage`, `WorklistPage`, `WorkbasketPage`, and admin list pages.

2. **Unify empty/loading/error states**
   - Choose one canonical `EmptyState` component API and migrate consumers.
   - Ensure empty states always include: title, contextual message, and one next-step action.
   - Normalize skeleton + loading copy (`Loading cases…`, `Loading workbasket…`) to reduce cognitive switching.

3. **Replace blocking browser dialogs with in-app confirmations**
   - In `WorkbasketPage`, replace `confirm()` with `ActionConfirmModal` (already used in other areas).
   - Add clearer confirmation copy: object + impact + irreversible consequences.

4. **Form/control normalization on legacy pages**
   - Replace `neo-input` usage with shared `Input` / `Select` where feasible.
   - Align spacing rhythm (`space-y-4`, consistent label/help/error layout).

### Deliverables
- One-page UX standards checklist for contributors.
- Updated `WorkbasketPage` interaction parity.
- Reduced visual drift across list and queue screens.

### Success metrics
- 30–40% reduction in UI support questions related to “where actions are”.
- Fewer interaction errors on pull/bulk-pull flows.

---

## Phase 2 (Weeks 3–5): Core Workflow Simplification

### Goals
- Make high-frequency workflows faster and more predictable.
- Reduce navigation and filtering friction.

### Improvements
1. **Converge queue experiences (`Cases`, `Worklist`, `Workbasket`)**
   - Move `WorkbasketPage` to shared `DataTable` patterns (sortable headers, active filter chips, reset behavior).
   - Reuse row action affordances and keyboard support patterns from `WorklistPage`.

2. **Harden query-state persistence across all list pages**
   - Apply consistent URL state (`sort`, `order`, `status`, `q`) across every operational list.
   - Preserve state on back-navigation from detail pages for continuity.

3. **Unify filter architecture**
   - Introduce common filter bar primitives (text, select, date range, chips, reset all).
   - Ensure mobile behavior collapses gracefully (drawer or stacked form).

4. **Action feedback reliability pass**
   - Every mutating action should expose deterministic states: idle → loading → success/error.
   - Standardize success toasts and inline status where the user took action.

### Deliverables
- Shared queue/list blueprint component contract.
- Parity behavior docs for sorting/filter/search/pagination.

### Success metrics
- Faster task completion in key scenarios (find case, pull case, re-open list state).
- Lower abandonment on filtered views.

---

## Phase 3 (Weeks 6–8): Accessibility & Information Architecture

### Goals
- Reach a reliable accessibility baseline.
- Improve discoverability and orientation for new users.

### Improvements
1. **Accessibility baseline (WCAG-focused)**
   - Audit color contrast for status badges, low-emphasis text, and disabled controls.
   - Ensure all interactive elements have visible focus states and semantic roles.
   - Validate keyboard traversal for sidebar, table rows, and modal dialogs.

2. **Navigation IA cleanup**
   - Rationalize route naming and menu grouping by user intent (Operate / Review / Admin).
   - Reduce overlap between old/legacy paths and current path affordances.

3. **Auth and onboarding unification**
   - Align `LoginPage` and `FirmLoginPage` copy hierarchy and helper text patterns.
   - Add progressive disclosure in OTP steps (what happens next, resend behavior clarity).

4. **Metadata and timestamp consistency**
   - Standardize `updated by / updated at` formatting across cards, tables, and detail headers.
   - Use absolute + relative time in high-audit contexts.

### Deliverables
- Accessibility checklist integrated into PR template.
- Updated navigation taxonomy and auth copy map.

### Success metrics
- Keyboard-only completion of top 5 workflows.
- Reduced first-session drop-off on sign-in + onboarding.

---

## Phase 4 (Weeks 9–12): Performance, Trust Signals, and Product Polish

### Goals
- Improve perceived speed and operational confidence.
- Create a stronger “enterprise-ready” finish.

### Improvements
1. **Perceived performance enhancements**
   - Add optimistic updates where safe (e.g., non-destructive status changes).
   - Improve skeleton specificity per module (not generic blocks only).
   - Reduce layout shift in tables and cards during data refresh.

2. **Trust and audit UX upgrades**
   - Expand inline audit metadata in list/detail contexts.
   - Surface storage-health/ops warnings with actionable guidance.

3. **Design system governance**
   - Finish token consolidation (`theme/tokens.js` + legacy bridges).
   - Decommission duplicate primitive components after migration.

4. **Measurement and UX telemetry**
   - Define event schema for friction points (filter resets, failed submit retries, modal cancels).
   - Build a lightweight UX KPI dashboard (time-to-first-action, repeat errors, flow completion).

### Deliverables
- Polished interaction library for all critical actions.
- UX KPI instrumentation + monthly review ritual.

### Success metrics
- Lower retry/error loops on action-heavy pages.
- Improved user confidence scores in internal feedback.

---

## Priority sequence (recommended)

1. **First fix consistency debt** (Phase 1) because it gives immediate UX gains with low architectural risk.
2. **Then unify list workflows** (Phase 2) because your product’s core value is operational throughput.
3. **Then formalize accessibility and IA** (Phase 3) to scale reliability and reduce cognitive load.
4. **Finally instrument and polish** (Phase 4) so improvements are measurable and sustainable.

## Suggested ownership model

- **UX/Product:** standards, copy, acceptance criteria.
- **Frontend:** component consolidation, workflow parity, accessibility fixes.
- **Platform/Backend:** stable list/filter contracts and action-response payloads.
- **QA:** workflow matrix with keyboard + error-path coverage.

### Queue consistency workstream update (2026-04-23)

Completed:
- Shared queue table behavior standardized for row focus/open keyboard behavior, sort control semantics, refresh notices, and filter-chip reset affordances.
- Worklist and Workbasket now use a shared queue filter-bar shell (`QueueFilterBar`) to align sizing/spacing and clear-all behavior.
- QC queue actions now route through `ActionConfirmModal` with consistent operational wording and destructive affordance for fail actions.

Manual QA checklist:
1. Verify row open via mouse click and keyboard (Tab to row + Enter/Space) in All Dockets, Worklist, and Workbasket.
2. Verify active filter chips can be removed individually and cleared in bulk on all queue screens.
3. Trigger QC pass/correct/fail and confirm modal copy + cancel/confirm keyboard behavior.
4. Trigger background refresh and verify existing rows stay visible while refresh notice is shown.

Remaining follow-ups:
- Platform shared queue table still uses a page-local implementation; evaluate full consolidation into common DataTable in a future incremental PR.

## Incremental pilot support UX hardening (April 25, 2026)

### Implemented in this increment
- Added shared access-denied recovery component for platform queue/report surfaces.
- Added shared support-context component (request ID, reason code, module, timestamp, safe status).
- Added centralized recovery copy map for auth/storage/upload/access/inactive scenarios.
- Improved upload failure recovery copy in docket attachments with retry-safe guidance.
- Improved storage settings recovery messaging with role-specific admin guidance.

### Why this was prioritized
This reduces dead-end states during pilot onboarding and enables support teams to triage issues without exposing tenant-private diagnostics.

### Follow-up UX backlog
- Roll shared access-denied + support-context pattern into remaining legacy pages.
- Add explicit inactive-client/inactive-assignee inline states in all create/assign forms.
- Add visual regression + journey tests for session-expiry redirect message behavior.
