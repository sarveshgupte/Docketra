# CRM UX Guidelines (Leads + Clients)

Date: April 28, 2026  
Scope: Frontend-only CRM product UX improvements (no backend contract changes).

## CRM UX principles

1. **Operational first:** prioritize scanability and next action clarity over visual decoration.
2. **Lead vs client distinction:** leads represent pre-conversion pipeline work; clients represent active workspace records.
3. **Follow-up discipline:** each lead view should surface follow-up timing and overdue risk clearly.
4. **Role-safe controls:** mutation controls remain visible only to existing permitted roles.
5. **Predictable states:** loading, empty, and error states must always explain what to do next.

## Lead pipeline display rules

- Keep canonical stage values unchanged (`new`, `contacted`, `qualified`, `converted`, `lost`).
- Display stage labels in plain operational language for quick scan.
- Show stage helper copy in pipeline view so each column communicates expected workflow behavior.
- Keep quick stage update behavior unchanged; conversion still routes through existing convert endpoint.

## Client workspace rules

- Client detail remains the operational workspace for deals, dockets, and invoices.
- Always show client classification/status context in the header area.
- Keep tab model unchanged (`deals`, `dockets`, `invoices`) while improving empty-state guidance.
- Preserve existing docket linking and client route behavior.

## Follow-up visibility rules

- Show both formatted date and relative timing intent (e.g., Today, Tomorrow, overdue days) for lead follow-up dates.
- Keep overdue indicator visible for non-converted/non-lost leads.
- Preserve existing `dueOnly` filtering semantics and API contract.

## Action hierarchy

- **Primary actions:** create lead/client, add deal/invoice.
- **Secondary actions:** view mode toggle, refresh, open related workspace.
- **Context actions:** edit/deactivate client, stage update, mark invoice paid.
- Keep action grouping close to data context (list row, section, modal footer).

## Role-safe behavior notes

- Existing permission model is preserved (no RBAC logic changes).
- Admin-only CRM mutation controls remain admin-only:
  - lead owner/stage quick updates
  - client create/edit/deactivate
  - add deal/invoice and mark invoice paid
- Non-admin users continue to see read/review surfaces without elevated controls.

## What changed in this PR

- Leads page: clearer follow-up visibility, filter reset affordance, role-safe helper copy, and richer pipeline-stage context text.
- Clients page: clearer filter usability (`Clear filters`), role-safe helper copy, and improved filtered-empty messaging.
- Client detail page: stronger workspace header context, status badge visibility, improved no-contact guidance, and clearer tab empty-state/action helper text.
- Added shared relative-date helper used for follow-up visibility.

## What remains for later

1. CRM-specific keyboard/a11y QA pass across dense tables and modal forms.
2. Optional active-filter chips for CRM list pages using shared table/filter chip contract.
3. Deeper lead/client productivity aids (e.g., saved CRM views) if product approves without API changes.
4. Future CRM analytics widgets (pipeline aging, owner load) if backend contracts are explicitly extended in a later phase.

## Review corrections (post-feedback)

- Kept CRM client load errors in **table-level messaging** only (single error location) and retained retry action in the table.
- Kept background refresh messaging in page-level status stack without duplicating table load errors.
- Clarified lead filter behavior: filters auto-apply via existing state/effect data loading; renamed button text to `Refresh` for accuracy.
- Corrected non-admin helper copy to avoid implying change permissions.
- Re-tokenized newly added lead UX classes to `--dt-*` tokens (text/border/surface/warning/focus) in touched CRM surfaces.
- Added a focused test for `formatRelativeDateLabel` covering empty/invalid values, relative day labels, and timezone-offset parsing behavior.
- Updated client status badge tone mapping to explicit visual variants (`success` for active, `neutral` for inactive) without changing stored status values.
- Kept Client Detail header/back action as a single location (PlatformShell actions), avoiding duplicate back controls in section action rows.
- Updated invoice modal helper copy to: “Use invoices here for CRM payment visibility. Existing billing behavior is unchanged.”

## Preservation confirmation

- This PR remains **frontend-only** (no backend/controller/service/model changes).
- No API contracts, payload shapes, routes, auth, RBAC, tenant isolation, lifecycle logic, or database behavior were changed.
