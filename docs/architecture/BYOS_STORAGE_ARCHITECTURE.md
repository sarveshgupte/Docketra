# BYOS Storage Architecture (Canonical)

## Canonical provider resolution

`src/services/storage/StorageProviderFactory.js` is the **only** runtime resolver for firm-scoped storage providers.

All runtime storage flows (docket attachments, backup/export, direct upload) must resolve providers via:

- `StorageProviderFactory.getProvider(firmId)`

`src/services/storageAdapter.service.js` remains as a backward-compatible shim and now delegates to `StorageProviderFactory`.

## Provider interface contract

All provider implementations are expected to expose:

- `providerName`
- `testConnection()`
- `uploadFile(parentOrPath, fileName, streamOrBuffer, mimeType)`
- `downloadFile(fileIdOrObjectKey)`
- `listFiles(parentOrPath)`
- `generateDownloadUrl(fileIdOrObjectKey, ttlSeconds)` (where supported)
- `getOrCreateFolder(parentId, name)` (where supported)

If unsupported, providers must throw `UnsupportedProviderFeatureError`.

`uploadFile` must return a canonical `fileId` / object key. Providers may additionally return legacy `id`, and service code must normalize (`fileId || id`) for backward compatibility. `uploadFile` must accept either a `Buffer` or a readable stream as payload input.
`listFiles(null)` must be handled explicitly by providers (for example, Drive root or configured root context) and must not emit malformed provider queries.

## Runtime flow boundaries

- Docket attachment operations use provider methods resolved by `StorageProviderFactory`.
- Backup operations use provider methods resolved by `StorageProviderFactory`.
- Docket/backup services do **not** decrypt credentials or construct provider-specific clients directly.
- Docket attachment metadata is provider-neutral: always persist canonical storage file identifier; keep provider-specific fields only for explicit compatibility needs.
- S3 object keys must be tenant-scoped exactly once (no double-prefixing).
- Google Drive uploads must never send `parents: [null]`; omit parents when no folder is provided.
- S3 key normalization rules apply to **all** object-key operations (upload/download/list, signed URL generation, direct upload sessions, and verification).
- S3/object-key providers are not required to implement folder APIs for backup upload; backup paths may upload directly by object key.
- Path traversal validation should reject traversal segments (`.` / `..`) while allowing safe filenames that merely contain `..` within a segment.

## Data boundaries (non-negotiables)

- Raw firm/client file payloads are stored in connected cloud storage providers (BYOS), not MongoDB.
- MongoDB stores metadata/control-plane records only (attachment metadata, backup job metadata, audit state).
- Provider credentials remain encrypted at rest in firm storage config.
- Logs/errors/tests must not expose refresh tokens or provider secrets.


## Managed fallback contract
- `docketra_managed` is the default active provider when firm-owned BYOS is not connected.
- Docketra-managed mode still writes bytes to object/file storage (managed S3 backend), never MongoDB.
- MongoDB stores only metadata/control-plane records for attachments/backups.
- Status values: `ACTIVE_MANAGED`, `ACTIVE_BYOS`, `DISCONNECTED`, `ERROR`.
- Firm-owned BYOS remains recommended for data ownership and control, but is not required for runtime storage.

- Managed runtime fallback env: `MANAGED_STORAGE_S3_BUCKET` and `MANAGED_STORAGE_S3_REGION` required; `MANAGED_STORAGE_S3_PREFIX` optional; credentials optional when instance/task IAM role is used.
- Middleware and API client responses must be sanitized (`STORAGE_NOT_CONNECTED`) while detailed provider diagnostics remain server-side logs only.
