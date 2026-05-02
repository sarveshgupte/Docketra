# Redis production requirements for security controls

## Why Redis is required in production

Docketra uses Redis-backed controls for brute-force and abuse protection on security-sensitive auth flows.

When `NODE_ENV=production` and Redis is unavailable, these controls **fail closed** and return `503 SECURITY_DEPENDENCY_UNAVAILABLE` instead of silently degrading protection.

## Security-sensitive controls that fail closed in production

The following controls require Redis readiness in production:

- Login rate limiting (`loginLimiter`) for:
  - `/superadmin/login`
  - `/:firmSlug/login`
  - any login endpoints wired with `loginLimiter`
- Superadmin/tenant/public auth block gate (`authBlockEnforcer`) on auth flows
- Forgot password limiter (`forgotPasswordLimiter`)
- OTP verify limiter (`otpVerifyLimiter`)
- OTP resend limiter (`otpResendLimiter`)
- Sensitive write limiter (`sensitiveLimiter`)
- Auth limiter (`authLimiter`)

## Controls that do not fail closed

Non-security public reads and general non-sensitive limits may continue with in-memory rate-limit state when Redis is unavailable. This preserves availability for low-risk traffic while critical auth protections remain strict.

## Required environment variables for production

At minimum:

- `NODE_ENV=production`
- `REDIS_URL=redis://...` (valid Redis URL)

Optional escape hatch (not recommended except controlled break-glass):

- `ALLOW_REDIS_FALLBACK=true`

`ALLOW_REDIS_FALLBACK=true` can permit degraded startup behavior when Redis is unavailable, but production security-sensitive endpoints still fail closed until Redis is ready.

## Expected degraded behavior

If Redis is down in production:

1. API process may still start (depending on deployment/startup policy).
2. Security-sensitive auth endpoints listed above return `503`.
3. Non-security public reads continue where in-memory fallback is acceptable.
4. Once Redis is ready, security endpoints resume normal operation without redeploy.

## Deployment checklist

- Ensure Redis is reachable from all API instances.
- Configure health checks/alerts for Redis readiness and latency.
- Validate fail-closed behavior in staging by simulating Redis outage.
- Confirm incident runbooks include Redis recovery steps before auth traffic is reopened.
