# BYOS Storage Architecture (Umbrella)

This document is the source of truth for Docketra BYOS storage behavior across **client profiles** and **file uploads**.

## 1) Core BYOS principles
- Firm data bytes should live in tenant storage whenever possible.
- Docketra app servers should avoid durable file-byte persistence for normal product workflows.
- Multi-tenant boundaries are enforced by server-side firm context, never client-supplied tenant identifiers.

## 2) Client profile storage architecture (existing)

### 2.1 Sensitive profile fields are storage-backed
- Sensitive profile fields are not treated as canonical Mongo fields after migration.
- `Client.profileRef` is the canonical pointer for profile payload location/version/checksum.
- Hydration-only behavior: API reads hydrate profile fields from storage references at read time.

### 2.2 `profileRef` contract
`Client.profileRef` tracks:
- `provider`
- `mode` (`firm_connected` | `managed_fallback`)
- `fileId` (provider-native ID where applicable)
- `objectKey` (object path/key where applicable)
- `checksum`, `version`, `schemaVersion`, timestamps

### 2.3 Backend resolution and fallback
Profile storage backend resolution uses:
1. firm-connected provider (when available)
2. Docketra-managed fallback storage
3. fail closed if neither backend is available

### 2.4 Write guarantees / rollback guarantees
- Approval and create/update flows must preserve storage-write-first guarantees for profile payloads.
- Failure to persist required profile storage state must not silently commit an inconsistent profile boundary.
- Rollback helpers (`persistClientProfileOrRollback`) remain required guardrails for approval/create flows.

## 3) Direct upload architecture (new primary upload path)

For details, see `docs/architecture/byos-direct-upload-flow.md`.

### 3.1 Supported upload modes
- `firm_connected`: upload directly to tenant-connected provider.
- `managed_fallback`: upload directly to Docketra-managed S3 fallback when firm-connected backend is unavailable.

### 3.2 Upload trust model
- Backend issues tenant-scoped upload intent + upload session metadata.
- Client uploads bytes directly to storage provider URL.
- Finalize verifies expected provider identity/object scope from server-stored session metadata.
- Client completion metadata is optional and cannot override server-tracked identity.
- Finalize backend resolution is pinned to session `providerMode`; current tenant storage state cannot override session backend.

### 3.3 Upload session lifecycle
Upload session record states:
- `initiated`
- `uploaded` (optional intermediate)
- `verified`
- `failed`
- `abandoned`

Finalize behavior guarantees:
- Idempotent finalize for already `verified` sessions (returns linked attachment).
- Expired sessions transition to `abandoned`.
- Verification/checksum failures transition to `failed`.

Retention/cleanup:
- Terminal sessions (`verified`, `failed`, `abandoned`) are assigned `cleanupAt`.
- Mongo TTL index on `cleanupAt` deletes stale terminal sessions automatically after configured retention.

### 3.4 Legacy upload pipeline status
- Legacy server-staged multipart upload endpoints are deprecated.
- Legacy worker/local-path upload flow remains **legacy-only** for historical jobs and explicit emergency fallback, not the default path for normal product uploads.
