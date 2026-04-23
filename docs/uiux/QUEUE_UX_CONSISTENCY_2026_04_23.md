# Queue UX Consistency Note — 2026-04-23

## Inconsistencies found
- Worklist/Workbasket/Cases had divergent filter-bar spacing and clear/reset semantics.
- Refresh states were shown as ad-hoc text placements across queues.
- Keyboard row focus/open behavior was not consistently visible or operable.
- QC row actions executed immediately without in-app confirmation parity.

## Standardization implemented
- Shared `DataTable` now supports:
  - visible keyboard row focus ring and Enter/Space row open
  - semantic sort buttons in headers
  - inline background refresh notice
  - standardized empty-with-filters state and retryable inline error state
  - optional consistent pagination controls
- Shared `QueueFilterBar` introduced and adopted in Worklist + Workbasket.
- Active filter chips standardized (remove individual + clear all).

## Confirm dialog replacements
- QC queue `Pass`, `Return for correction`, and `Fail` actions now use `ActionConfirmModal`.
- No browser-native `window.confirm()` remains in the four target queue surfaces.

## Manual QA steps
1. Open each queue screen and verify table density, header sort affordance, hover/focus state, and row open behavior.
2. Verify filter controls, chip rendering, chip removal, and clear-all behavior.
3. Trigger background refresh and ensure rows are not blanked.
4. Validate empty state copy with/without filters.
5. Validate QC modal keyboard flow (Tab, Escape, Enter) and destructive styling for fail action.

## Follow-up items
- Consider replacing platform-local `PlatformShared` table with common table component for full stack parity.
- Extend queue consistency checks with interaction-level E2E tests when automated browser suite is available.
