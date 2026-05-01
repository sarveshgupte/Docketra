# Redis Fallback Behavior (Production Contract)

## Contract

- Redis is required for production-grade Docketra operation.
- API startup must still bind to `PORT` even when Redis is unreachable.
- Security-sensitive controls fail closed when Redis is unavailable in production.

## Env validation

- `REDIS_URL` remains required/recommended in production deployment documentation.
- `REDIS_URL` is strictly validated (`redis://` or `rediss://` only).
- In production, if `REDIS_URL` is missing and `ALLOW_REDIS_FALLBACK=true` is not set, env validation emits a loud warning and startup proceeds in degraded mode.

## Startup behavior

- `lazyConnect: true` is used.
- A single `redisConnectPromise` guards connection attempts.
- `getRedisClient()` never calls `connect()` twice on the same client.
- Startup logs include:
  - `REDIS_CONFIGURED=true/false`
  - `REDIS_READY=true/false`
  - explicit degraded-startup continuation messaging.

## Fail-closed vs fallback behavior

Fail closed in production when Redis is unavailable:
- auth brute-force limits
- OTP resend/verify throttles
- forgot-password throttles
- sensitive API rate limits

May use in-memory fallback:
- non-security features (e.g. local idempotency/cache behaviors where already supported).

## Health/readiness

When Redis is unreachable, health/readiness should report degraded/unavailable Redis state while the API process stays alive and bound to `PORT`.
