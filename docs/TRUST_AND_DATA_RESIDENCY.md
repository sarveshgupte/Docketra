# Trust and Data Residency

## Docketra control-plane-only model
Docketra operates as a control plane. The platform manages identity, routing, permissions, workflow metadata, and operational diagnostics. Core firm business documents should remain in firm-controlled storage via the active storage provider.

## What MongoDB stores
MongoDB stores control-plane metadata such as:
- Firm and user identity/auth records
- Role hierarchy and permission state
- Docket/task metadata (status, assignees, timestamps, references)
- Storage configuration state (sanitized), health-check status, and export metadata
- Operational audit and reliability telemetry

## What firm cloud stores
Firm cloud storage (for example connected Google Drive) is the canonical location for business documents and file payloads, including client files, CFS folders, docket attachments, and related uploaded artifacts.

## What Docketra never stores
Docketra does not intentionally expose or return sensitive storage secrets in settings surfaces or API summary responses, including refresh/access tokens, `rootFolderId`, `driveId`, `privateKey`, or raw provider secret keys.

## How firms can verify storage location
Primary Admins can verify the active storage provider and storage map in **Storage Settings → Data storage map**. The section shows provider status, connected account context, canonical location notes, metadata categories, and current/planned cloud path conventions. Firms can also generate a **storage export** for audit workflows.

## Limitations and current migration status
- BYOS-first is the target architecture, but Docketra-managed fallback remains available when firm-owned storage is not connected.
- Existing historical records may include legacy routing/config metadata while migration normalization continues.
- Folder path displays are canonical conventions for verification and governance; path rendering does not expose raw internal provider IDs.

- Storage folder verification links are resolved server-side through a sanitized endpoint (`GET /api/storage/folder-link`) that returns only a Google Drive folder URL and provider context; secrets (refresh/access tokens, private keys, raw credentials) are never returned.
