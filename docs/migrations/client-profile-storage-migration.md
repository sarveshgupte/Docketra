# Client Profile Storage Migration

## Purpose
Move existing sensitive client payloads out of MongoDB and into storage-backed JSON profile objects.

## Script
`scripts/migrations/migrate_client_profiles_to_storage.js`

## Run
```bash
MONGODB_URI="mongodb://..." \
MANAGED_STORAGE_S3_BUCKET="..." \
MANAGED_STORAGE_S3_REGION="..." \
node scripts/migrations/migrate_client_profiles_to_storage.js
```

## Behavior
- Scans all clients (skips default/system client)
- Idempotent skip for already-migrated records with no residual sensitive fields
- Writes profile JSON to active storage backend
- Updates `Client.profileRef`
- Clears sensitive Mongo fields via service save path
- Logs only client/firm identifiers and error reason (no sensitive payload)
- After migration, sensitive profile fields are hydration-only in API responses and must not be used as Mongo query/write fields.
- Post-migration write invariants apply uniformly to both direct and approval-based client creation flows (explicit `clientId`, storage-backed profile write, rollback on storage failure).

## Partial failure handling
- Script continues after per-record failure
- Non-zero exit code when failures exist
- Re-run safely; completed records are skipped

## Rollback
- Storage profile objects are versioned (`vN` filenames/keys)
- If rollback is required, restore by reading prior profile version and explicitly re-writing via service
- Do not reintroduce sensitive Mongo persistence in rollback
