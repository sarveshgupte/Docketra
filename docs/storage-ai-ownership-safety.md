# Storage/AI ownership resolution safety

## Read configuration endpoints

The following GET endpoints are read-only and may return safe defaults when tenant→ownership mapping is unavailable but `req.firmId` exists:

- `GET /api/storage/configuration`
- `GET /api/ai/configuration`

Behavior:

- Attempt canonical ownership resolution first.
- If ownership mapping is missing and tenant context (`req.firmId`) exists, fallback is allowed **for reads only**.
- If no persisted config exists, responses still return `200` with safe defaults.
- Responses must never expose secrets (API keys, refresh tokens, raw provider credentials, auth tokens).

## Write/test/mutation endpoints (fail closed)

Storage and AI endpoints that write, test, reconnect, disconnect, or otherwise mutate configuration/provider state must fail closed when ownership mapping cannot be resolved.

- No write/test endpoint may fallback to `req.firmId`.
- Missing mapping returns a client error (`400` Tenant mapping missing) to prevent cross-firm persistence.

This split prevents accidental writes to the wrong firm while keeping Settings pages resilient for read-only rendering.
