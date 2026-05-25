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
- [x] Clients page loads successfully (verified in local UI run).
- [x] Clients table remains readable and does not overflow badly on desktop/tablet/mobile widths (manual viewport checks at desktop/tablet/mobile widths).
- [x] Client search matches by client ID and business name/email (backed by controller search condition + targeted test evidence).
- [x] Storage badge popover text wraps cleanly (manual check on narrow viewport + CSS grid stacking).
- [x] Storage Settings and Data Storage Map links still resolve through existing protected routes (no route-gate changes in this PR).
- [x] Firm worklist scoped workbasket navigation behavior remains unchanged (no changes to platform Worklist files or scoped query usage).

## Explicitly not changed
- Auth login/OTP flows and auth controllers/services/models.
- Protected route gate logic.
- Platform worklist scoped workbasket query behavior.
- Dependency lockfiles.

## Verification evidence
- Automated: `node --check src/controllers/client.controller.js` passed.
- Automated: `node tests/clientListSearchFields.test.js` passed for `clientId` + `businessName` + `businessEmail` search clauses.
- Automated: `node ui/tests/storageStatusBadgeLinksClasses.test.mjs` passed for updated storage link class rendering.
- Automated: `npm --prefix ui run build` and `npm --prefix ui run test:ci` passed in this environment.
