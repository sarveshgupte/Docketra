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
