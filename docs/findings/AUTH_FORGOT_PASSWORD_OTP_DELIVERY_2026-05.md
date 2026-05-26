# AUTH Forgot-Password OTP Delivery Hotfix (2026-05)

## Symptom
- `POST /api/auth/forgot-password/init` returned 200 with enumeration-safe message, but users did not receive OTP.
- `POST /api/auth/forgot-password/verify` could surface generic server failures instead of controlled invalid/expired OTP responses.

## Confirmed root cause
- Forgot-password OTP send path had no explicit attempted/succeeded/failed diagnostics, making delivery failures opaque in production logs.
- OTP send errors were not checkpointed with safe metadata for quick triage.
- Verify path did not harden unexpected verification exceptions into controlled invalid/expired OTP response semantics.

## Fix
- Added safe diagnostics around OTP delivery:
  - `FORGOT_PASSWORD_OTP_SEND_ATTEMPTED`
  - `FORGOT_PASSWORD_OTP_SEND_SUCCEEDED`
  - `FORGOT_PASSWORD_OTP_SEND_FAILED`
- Added safe diagnostics around OTP verification:
  - `FORGOT_PASSWORD_VERIFY_ATTEMPTED`
  - `FORGOT_PASSWORD_VERIFY_FAILED` with checkpoint markers.
- Diagnostics include requestId + safe tenant/user context (firmId/tenantId, userId/userXID), and exclude OTP/password/token/secret fields.
- Kept enumeration-safe init behavior (`200` generic response) even if email provider fails.
- Wrapped verify flow with controlled fallback so normal/expected invalid conditions return invalid/expired semantics instead of generic server errors.

## Tests
- Forgot-password OTP reliability tests cover:
  - known user init sends exactly one OTP
  - unknown user returns safe 200 and no send
  - verify valid OTP succeeds
  - verify invalid OTP returns controlled 401
  - verify missing OTP state returns controlled 401
  - provider failure during send still returns safe 200
  - verify internal exception returns controlled 401

## Render verification checklist
1. Call `POST /api/auth/forgot-password/init` with valid tenant + user.
2. Confirm logs show `FORGOT_PASSWORD_OTP_SEND_ATTEMPTED` then `...SUCCEEDED` (or `...FAILED`) with requestId.
3. Confirm no OTP/password/token/cookie data is present in logs.
4. Verify valid OTP returns success with reset token.
5. Verify invalid OTP returns controlled invalid/expired response (no SERVER_ERROR).
6. Verify missing/expired OTP state returns controlled invalid/expired response.
