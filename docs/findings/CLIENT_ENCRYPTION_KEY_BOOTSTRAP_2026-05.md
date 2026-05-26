# Client Encryption Key Bootstrap – May 2026

## Symptom
`GET /clients` returned `TENANT_KEY_MISSING` with `read_only_mode`, causing clients page to remain in a safe read-only error state.

## Root Cause
Client records can remain ownership-scoped under legacy/root firm ids while runtime auth/request scope is workspace/default-client tenant id. Tenant key lookup only checked one id, so valid legacy keys were missed.

## Fix
- Added tenant key lookup candidate resolution (`workspace`, canonical tenant, ownership firm, legacy firm ids).
- Reused resolved key tenant id for decryption path.
- Added admin-only repair endpoint (`POST /clients/encryption/repair`) that is idempotent and safe:
  - no overwrite if key exists
  - blocked when encrypted client data already exists and key is absent
- Added diagnostics events for lookup/repair lifecycle.
- Updated clients UI with explicit repair messaging and admin repair action.

## Tests
- Existing client/tenant/encryption tests + UI tests.
- Added/updated regression coverage around missing-key error and read-only recovery messaging.

## Production Repair Checklist
1. Confirm `MASTER_ENCRYPTION_KEY` is configured and stable.
2. Hit clients list endpoint and inspect diagnostic events.
3. If key missing and tenant has no encrypted client data, run `POST /clients/encryption/repair` as PRIMARY_ADMIN/ADMIN.
4. Re-try clients list and confirm normal load.
5. If encrypted data exists without key, escalate to manual recovery; do not generate/overwrite keys.
