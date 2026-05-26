# AUTH_RECOVERY_UI_STATE_RESET_2026-05

## Symptom
After forgot-password reset succeeds, users can land on firm login while stale OTP challenge UI state remains active (Step 2), causing a misleading "Email OTP / Submit & Sign in" screen despite successful password reset.

## Root cause
The firm login page accepted success navigation state from forgot-password but did not explicitly reset in-memory login OTP state (`step`, `loginToken`, `otp`, hint/cooldown, pending session keys). Success messaging could also render on non-credential steps.

## Fix
- Added a focused recovery-reset handler in `FirmLoginPage` to clear pending OTP/auth challenge state and force the page back to credential step.
- Applied this handler automatically when receiving password-reset success navigation state.
- Cleared stale navigation state with `navigate(..., { replace: true, state: null })` so success banner does not persist incorrectly.
- Restricted success banner rendering to credential step only.
- Updated forgot-password success message to: "Password reset successfully. Please sign in with your new password."
- Added reset cleanup for forgot-password Back to Login navigation to clear OTP/reset/token/error/success/timer state.

## Tests
- Added `ui/tests/authRecoveryStateReset.test.mjs` covering:
  - forgot-password reset success returns user to login credential step state handling
  - login OTP challenge state clear behavior
  - success banner credential-step-only rendering
  - Back to Login reset/OTP state cleanup
  - resend timer reset/clear on recovery reset

## Manual verification
1. Start forgot-password flow, complete verify + reset successfully.
2. Confirm redirected login page shows Step 1 credentials UI (xID/password), not OTP UI.
3. Confirm success banner text appears only on Step 1.
4. Confirm no auto-submit/login occurs.
5. Navigate Forgot Password -> Back to Login repeatedly and confirm no stale OTP state, server error, or request context persists on wrong step.
6. Confirm resend timer is not active after reset success redirection.
