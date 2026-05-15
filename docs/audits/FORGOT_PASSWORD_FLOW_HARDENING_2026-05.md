# Forgot Password / Reset Password Flow Hardening Audit (May 2026)

## Scope

Audited end-to-end forgot/reset paths across backend auth routes/controllers/services, frontend routes/pages/services, and regression tests.

## Routes audited

- Backend auth routes:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/forgot-password/init`
  - `POST /api/auth/forgot-password/verify`
  - `POST /api/auth/forgot-password/reset`
  - `POST /api/auth/reset-password-with-token`
- Frontend public routes:
  - `/:firmSlug/forgot-password`
  - `/forgot-password`
  - `/reset-password`
  - `/superadmin/login`, `/:firmSlug/login`

## Frontend pages/services audited

- `ui/src/pages/ForgotPasswordPage.jsx`
- `ui/src/pages/ResetPasswordPage.jsx`
- `ui/src/routes/PublicRoutes.jsx`
- `ui/src/services/authService.js`

## Backend controllers/services/schemas audited

- `src/routes/auth.routes.js`
- `src/controllers/auth.controller.js`
- `src/services/authPassword.service.js`
- `src/services/email.service.js`
- `src/schemas/auth.routes.schema.js`

## Issues found

1. Forgot-password OTP schema required `firmSlug`, while route/controller supported optional firm context resolution.
2. Invalid `firmSlug` in forgot-password OTP init returned non-generic behavior (enumeration signal via workspace validity).
3. Invalid `firmSlug` in verify/reset paths returned workspace-specific errors instead of token/OTP-safe generic failures.

## Fixes applied

1. Made `firmSlug` optional in forgot-password OTP route schemas for init/verify/reset, matching tenant-aware resolver behavior.
2. Hardened forgot-password OTP init to always return a generic success envelope when firm context is invalid.
3. Hardened forgot-password OTP verify/reset to return generic invalid/expired credential messages on invalid firm context.

## Tests added/updated

- No new test files added in this patch.
- Existing forgot-password reliability/context tests were re-run.

## Commands run

- `node tests/authForgotPasswordFirmContext.test.js`
- `node tests/authTenantWorkflow.test.js`
- `node tests/authForgotPasswordOtpReliability.test.js`
- `node tests/firmSlugRouteOrdering.test.js`
- `node tests/authRouteContract.test.js`

## Remaining limitations

1. Legacy token-link flow (`/reset-password-with-token`) still exists alongside OTP reset flow; maintainers should consider converging to one canonical flow later.
2. Session revocation after forgot-password reset is not explicitly enforced in this patch (left unchanged from current behavior).
3. Password-history reuse prevention is not introduced here; existing policy remains as-is.

## Readiness score

- **8.5/10** for private-pilot forgot-password reliability and safety hardening in this scoped pass.
- Key controls now improved: generic responses, schema/route consistency, and safer tenant-context failure behavior.
