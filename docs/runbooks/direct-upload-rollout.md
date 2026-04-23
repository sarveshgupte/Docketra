# Direct Upload Rollout Runbook

## Flags
- `DIRECT_UPLOADS_ENABLED` (default `true` unless explicitly `false`)
- `ALLOW_LEGACY_DISK_UPLOADS` (legacy emergency flag only; direct path remains default)

## Backends
- Primary: firm-connected provider.
- Fallback: managed S3 (`MANAGED_STORAGE_S3_BUCKET`, `MANAGED_STORAGE_S3_REGION`, optional credentials/prefix).

## Rollout checklist
1. Confirm frontend uses intent/finalize APIs for:
   - docket attachments
   - client CFS uploads
2. Confirm direct upload intent works for:
   - connected provider tenants
   - fallback-only tenants (no connected provider)
3. Confirm finalize enforces identifier matching and tenant-scoped verification.
4. Monitor upload session statuses (`initiated`, `verified`, `failed`, `abandoned`).
5. Verify no new direct-upload sessions use `localPath`.

## Rollback strategy
- If direct upload must be paused: set `DIRECT_UPLOADS_ENABLED=false`.
- Legacy path remains deprecated and should only be re-enabled in controlled emergency scenarios.

## Operational alerts
Alert on:
- `STORAGE_NOT_AVAILABLE`
- `UPLOAD_SESSION_EXPIRED`
- `UPLOAD_VERIFICATION_FAILED`
- identifier mismatch rejections
