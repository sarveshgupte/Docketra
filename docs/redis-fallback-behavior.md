# Redis Fallback Behavior (Production-Safe)

## Summary

Docketra now treats Redis as **optional** at API startup. If Redis is missing, invalid, or temporarily unreachable, the API continues startup and binds to `process.env.PORT`.

## Startup behavior

- `REDIS_URL` missing/blank: Redis-backed features are disabled and in-memory fallbacks are used where implemented (e.g., rate limiting/idempotency on a single instance).
- `REDIS_URL` invalid: Redis-backed features are disabled with a structured warning log.
- `REDIS_URL` present but Redis unreachable/timeouts: startup continues; warnings are logged; no hard process exit is triggered by Redis initialization.

## ioredis safety configuration

- `lazyConnect: true` to avoid blocking app boot
- bounded `connectTimeout` and `commandTimeout`
- `enableOfflineQueue: false` for non-critical startup paths
- retry strategy disabled in production (`null`) to avoid runaway reconnect loops

## Render deployment expectation

On Render, transient Redis outages or command timeouts should **not** prevent the Node process from opening the configured HTTP port.

Redis remains recommended for distributed throttling/queue reliability, but API boot is no longer Redis-fatal.
