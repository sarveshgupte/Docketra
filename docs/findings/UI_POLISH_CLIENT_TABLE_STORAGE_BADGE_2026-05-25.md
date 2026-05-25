# UI polish findings — Clients table + storage status badge (2026-05-25)

## Scope
This update is intentionally limited to UI/UX polish and safe client-list query improvements.

## What changed
- Improved Clients table readability by allowing long business names/emails/phone values to wrap instead of clipping or forcing overflow.
- Kept existing actions (Edit Client, Activate/Deactivate, Edit CFS, Create Docket) intact.
- Confirmed clients list columns display `clientId`, `businessName`, `businessEmail`, `primaryContactNumber`, `status`, and `createdAt`.
- Expanded server-side client-list search matching to include `clientId`, `businessName`, and `businessEmail` for list filtering.
- Improved storage status popover spacing and text wrapping for narrow viewports.
- Styled “Storage Settings” and “Data Storage Map” links as clearer action chips.

## Manual verification checklist
- [ ] Clients page loads successfully.
- [ ] Clients table remains readable and does not overflow badly on desktop/tablet/mobile widths.
- [ ] Client search matches by client ID and business name/email.
- [ ] Storage badge popover text wraps cleanly.
- [ ] Storage Settings and Data Storage Map links still resolve through existing protected routes.
- [ ] Firm worklist scoped workbasket navigation behavior remains unchanged.

## Explicitly not changed
- Auth login/OTP flows and auth controllers/services/models.
- Protected route gate logic.
- Platform worklist scoped workbasket query behavior.
- Dependency lockfiles.
