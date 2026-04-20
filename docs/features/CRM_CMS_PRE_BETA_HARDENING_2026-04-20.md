# CRM/CMS Pre-Beta Hardening Update (2026-04-20)

## Scope
Focused hardening pass on **CRM** and **CMS** workflows only to improve trust, correctness, and first-client usability.

## What was fixed

### CRM
- Improved **table row navigation reliability** in CRM client lists and linked dockets:
  - Rows now support keyboard navigation (`Enter`/`Space`) and focus via `tabIndex`.
- Prevented **duplicate deactivation submits** in Client Management by introducing per-row pending state.
- Added **basic email format validation** on client create/edit to catch obvious invalid entries before API calls.
- Improved modal reliability in client detail:
  - Deal/Invoice modals now close with explicit reset handlers to avoid stale values on reopen.
- Improved lead modal reliability:
  - New Lead and Manage Lead modal close actions now reset local form/selection state.

### CMS
- Fixed broken/inconsistent route generation for intake settings quick action:
  - Correct anchor route generation with `safeRoute(...)` and `firmSlug`-based path construction.
- Prevented **duplicate form submits** in form editor via early return when save is already in progress.
- Fixed **stale editor state after save**:
  - Form editor now rehydrates on updated selected form object, not only ID.
- Closed form validation gaps:
  - Duplicate field key validation.
  - Redirect URL absolute format validation.
- Improved **API error messaging** for CMS leads/forms load + form save using shared CRM error resolver.

### CRM Overview/CMS Overview route safety
- Applied `safeRoute` for key CRM/CMS quick-action links to avoid undefined/null slug path generation issues.

## QA checklist (manual, non-technical)

Use a firm account with admin access.

### CRM - Client Management
- [ ] Open CRM → Client Management.
- [ ] Verify metrics cards load and table is visible.
- [ ] Create a new client with valid name/email/phone.
- [ ] Try invalid email (e.g., `abc@`) and confirm clear validation feedback.
- [ ] Edit existing client and confirm updated values persist after refresh.
- [ ] Click a row to open detail; also navigate with keyboard (`Tab` + `Enter`).
- [ ] Deactivate one client and confirm button shows pending state and cannot be double-submitted.

### CRM - Leads
- [ ] Create a lead with name + one contact method.
- [ ] Close/reopen “New Lead” modal and verify prior values are cleared.
- [ ] Open “Manage Lead”, change stage/owner/follow-up, save, confirm updates reflected in list.
- [ ] Close/reopen “Manage Lead” and verify stale note or stage edits are not lingering.
- [ ] Convert a lead and verify action feedback + linked client navigation when available.

### CRM - Client Detail
- [ ] Open a client detail from Client Management.
- [ ] Add deal, cancel modal, reopen, ensure previous values are reset.
- [ ] Add invoice, cancel modal, reopen, ensure previous values are reset.
- [ ] Mark unpaid invoice as paid and verify status updates.
- [ ] Navigate to linked docket row via mouse click and keyboard (`Enter`/`Space`).

### CMS
- [ ] Open CMS and verify overview cards and intake queue load.
- [ ] Use “Open Intake Settings” quick action; confirm it routes to Work Settings with `#cms-intake-settings` anchor.
- [ ] Create/edit form and confirm save success message.
- [ ] Attempt duplicate form field keys and verify validation blocks save.
- [ ] Enter invalid redirect URL and verify validation blocks save.
- [ ] Save form, then verify editor reflects persisted data after reload (no stale fields).

## Notes
- No unrelated refactors were introduced.
- No global styling redesign was performed.
- No speculative features were added.
