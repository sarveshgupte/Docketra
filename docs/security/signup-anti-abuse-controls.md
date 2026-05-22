# Signup Anti-Abuse Controls

## Scope
This document covers anti-spam controls for auth signup endpoints:
- `POST /api/auth/signup/init`
- `POST /api/auth/signup/verify`
- `POST /api/auth/signup/resend`

## Controls
- **Dedicated signup rate limiting (`signupLimiter`)** is applied to all three signup endpoints.
- **IP throttling** is always part of the key.
- **Hashed normalized email throttling** is added when `email` is present.
- **Hashed normalized workspace identifier throttling** is added when payload includes one of:
  - `firmSlug`, `workspaceSlug`, `workspace`, `workspaceName`, `firmName`, `companyName`, `organizationName`
- **No raw sensitive identifiers in limiter keys**: email and workspace-related fields are SHA-256 hashed.

## OTP-specific protections retained
- `POST /api/auth/signup/verify` continues to use `otpVerifyLimiter` in addition to signup limiter.
- `POST /api/auth/signup/resend` continues to use `otpResendLimiter` in addition to signup limiter.
- This preserves OTP brute-force and resend-throttle controls without changing login UX.

## Redis dependency and fail-closed behavior
- In production, signup anti-abuse protection is **security-sensitive** and fails closed when Redis is unavailable.
- Returned error remains generic and safe:
  - `503 SECURITY_DEPENDENCY_UNAVAILABLE`
- This avoids opening a signup abuse window in degraded production states.

## Logging and enumeration safety
- Do not log raw email/mobile/OTP/preAuthToken values.
- Signup endpoints should continue returning generic safe errors/messages to avoid user enumeration.

## Future hardening hook
- A CAPTCHA/Turnstile challenge hook can be layered onto signup init when risk signals are high (e.g., repeated limits by IP/email/workspace hash) while keeping the baseline flow friction-light for normal users.

## Cloudflare Turnstile (signup init only)
- Turnstile is scoped to `POST /api/auth/signup/init` only.
- It is **not** applied to login, forgot-password, OTP generic endpoints, or signup OTP verify/resend routes.
- Frontend uses `VITE_TURNSTILE_SITE_KEY` to render the widget and send `turnstileToken` (also supports `cf-turnstile-response` token key for compatibility).
- Backend uses `TURNSTILE_ENABLED` and `TURNSTILE_SECRET_KEY`.
- `TURNSTILE_SECRET_KEY` must never be sent to frontend code; backend validates token using Cloudflare Siteverify.
- Backend Siteverify validation is mandatory when `TURNSTILE_ENABLED=true`.
- In production, `TURNSTILE_ENABLED=true` without `TURNSTILE_SECRET_KEY` fails env validation and startup.


## Audit and abuse observability (privacy-safe)
- Signup flow now emits security audit events for:
  - `SIGNUP_INIT_ATTEMPT`
  - `SIGNUP_TURNSTILE_MISSING`
  - `SIGNUP_TURNSTILE_FAILED`
  - `SIGNUP_TURNSTILE_PASSED`
  - `SIGNUP_OTP_SENT`
  - `SIGNUP_OTP_VERIFY_ATTEMPT`
  - `SIGNUP_OTP_VERIFY_FAILED`
  - `SIGNUP_OTP_VERIFIED`
  - `SIGNUP_COMPLETED`
  - `SIGNUP_RATE_LIMITED`
- Event metadata includes only safe fields (for example request id, IP range, route/method, and optional hashed normalized email/workspace identifiers).
- Raw sensitive values are never logged in audit metadata: email, phone, OTP, password, Turnstile token, preAuthToken, or full request payloads.
- Turnstile audit/error handling remains scoped only to `POST /api/auth/signup/init`, and user-facing failures remain generic.
