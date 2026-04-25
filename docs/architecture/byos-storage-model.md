# BYOS Storage Model

## Architectural intent

Docketra follows a BYOS-first architecture:

- Docketra handles application workflow, metadata, authorization, and auditing.
- Firm/client document payloads are expected to remain in the firm-configured storage provider.
- `docketra_managed` mode exists as an operational fallback/default when BYOS is not configured.

## Storage trust surfaces

The firm Storage settings now expose a single summary view backed by `GET /api/storage/ownership-summary`:

- `activeStorage`: provider, mode, connection status.
- `lastHealthCheck`: last check timestamp and status.
- `fallbackStorage`: fallback provider + active/standby state.
- `backupExport`: backup enabled state and latest export metadata (if available).
- `warnings`: clear operational risks (for example, BYOS not configured).

## Isolation and permissions

- Route is tenant-scoped by `req.firmId` and reads only that tenant’s settings/backup metadata.
- Access is restricted to firm admins (including primary admin role).
- No provider credentials or secrets are returned in the ownership summary response.

## Operational behavior

- Backup/export paths continue to use existing storage backup services.
- Health summary reads existing provider status fields (including last checked timestamp when present).
- This change is visibility-focused and does not introduce new storage providers.
