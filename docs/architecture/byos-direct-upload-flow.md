# BYOS Direct Upload Flow

## Scope
Normal user upload paths:
- Docket attachments
- Client CFS attachments

## A) Intent → Upload → Finalize

1. **Create upload intent**
   - Endpoint returns:
     - `uploadId`
     - `provider`
     - `providerMode` (`firm_connected` or `managed_fallback`)
     - `uploadUrl`, `uploadMethod`, `uploadHeaders`
     - `providerFileId` (if known at intent-time, e.g., Google resumable create)
     - `objectKey` (if relevant, e.g., S3 object key)

2. **Client uploads bytes directly to storage provider**
   - Browser uploads bytes directly to provider URL.
   - App server does not persist file bytes to disk for this flow.

3. **Finalize**
   - Client sends `uploadId` and optional `completion` metadata.
   - Backend uses upload-session stored provider identity as source-of-truth.
   - Backend resolves the provider backend from session metadata (`providerMode`), not current tenant provider state.
   - Optional completion fields must match server-tracked identifiers if provided.
   - Backend verifies object ownership/path + MIME + size (+ checksum when comparable signals exist) and then registers immutable `Attachment` metadata.
   - Finalize is idempotent: already-verified sessions return the same attachment instead of creating duplicates.

## B) Provider-specific identity model
- **Google Drive**
  - Canonical provider identifier: `providerFileId` (Drive file ID)
  - `objectKey` is not required for canonical identity.
- **S3 / managed fallback**
  - Canonical provider identifier: `objectKey`
  - `providerFileId` may be null.

## C) Fallback behavior
Backend resolver sequence:
1. Try tenant-connected provider.
2. If unavailable, use managed fallback S3 backend.
3. If neither backend is available, return `STORAGE_NOT_AVAILABLE`.

Finalize does **not** rerun this generic sequence. It uses the backend mode recorded when the session was created:
- `firm_connected` session → must finalize against firm-connected backend.
- `managed_fallback` session → must finalize against managed fallback backend.

## D) Security and tenant isolation
- No cross-tenant finalize registration allowed.
- Finalize rejects session identifier mismatches.
- Expired sessions are marked `abandoned` and reject finalize (`UPLOAD_SESSION_EXPIRED`).
- Verification failures return `UPLOAD_VERIFICATION_FAILED`.
- Checksum mismatches return `UPLOAD_CHECKSUM_MISMATCH`.

## E) Checksum trust model
- Client can provide checksum at intent creation and/or finalize.
- Intent-time and finalize-time checksums must match when both are present.
- Provider-side checksum is enforced only when provider metadata exposes a comparable checksum.
  - Google Drive: `md5Checksum` available.
  - S3: `ETag` surfaced as `md5` signal (best-effort, not equivalent to SHA-256).
- If provider checksum is unavailable or non-comparable, backend still enforces intent-vs-finalize checksum consistency.

## F) Session lifecycle + cleanup
- States: `initiated` → `uploaded` (lock) → `verified`; terminal states `failed` / `abandoned`.
- Expired finalize attempts move session to `abandoned`.
- Verification/checksum failures move session to `failed`.
- Terminal sessions receive `cleanupAt`; Mongo TTL index removes stale terminal session rows after retention window.

## E) Legacy endpoints
Legacy multipart endpoints are deprecated.
- Return `410` when direct upload is enabled.
- Return `503` when direct upload is disabled (to avoid claiming active support for deprecated path).
