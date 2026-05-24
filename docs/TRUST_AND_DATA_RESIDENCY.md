# Trust and Data Residency

## Docketra control-plane-only model
Docketra operates as a control plane with a cloud-first migration in progress. Canonical new writes are cloud-first for selected domains, with legacy Mongo compatibility retained during transition. The platform manages identity, routing, permissions, workflow metadata, and operational diagnostics.

## What MongoDB stores
MongoDB stores control-plane metadata such as:
- Firm and user identity/auth records
- Role hierarchy and permission state
- Docket/task metadata (status, assignees, timestamps, references)
- Storage configuration state (sanitized), health-check status, and export metadata
- Operational audit and reliability telemetry

## What firm cloud stores
Firm cloud storage (for example connected Google Drive) is the canonical location for business documents and file payloads, including client files, CFS folders, docket attachments, and related uploaded artifacts.

For Google Drive BYOS, Docketra verifies storage root identity using folder ID plus a manifest file (`.docketra-storage-root.json`) rather than folder name alone. Folder renames are tolerated when identity still matches; folder deletion/trash or manifest tamper/missing state requires explicit recovery by a Primary Admin.

## What Docketra never stores
Docketra does not intentionally expose or return sensitive storage secrets in settings surfaces or API summary responses, including refresh/access tokens, `rootFolderId`, `driveId`, `privateKey`, or raw provider secret keys.

## How firms can verify storage location
Primary Admins can verify the active storage provider and storage map in **Storage Settings → Data storage map**. The section shows provider status, connected account context, canonical location notes, metadata categories, and current/planned cloud path conventions. Firms can also generate a **storage export** for audit workflows.

## Limitations and current migration status
- BYOS-first is the target architecture, but Docketra-managed fallback remains available when firm-owned storage is not connected.
- Existing historical records may include legacy routing/config metadata while migration normalization continues.
- Folder path displays are canonical conventions for verification and governance; path rendering does not expose raw internal provider IDs.

- Storage folder verification links are resolved server-side through a sanitized endpoint (`GET /api/storage/folder-link`) that returns only a Google Drive folder URL and provider context; secrets (refresh/access tokens, private keys, raw credentials) are never returned.

## Workspace-visible storage indicators
Authenticated firm workspace users can now see a persistent storage indicator in the platform header showing whether the workspace is currently using firm-owned Google Drive or Docketra-managed storage. The indicator links directly to Storage Settings and Data Storage Map for deeper verification without exposing secrets or internal provider identifiers.


- Added **Strict firm-owned storage mode** (Primary Admin controlled). When enabled, business-content writes require active firm-owned Google Drive and Docketra-managed fallback is disabled for writes.

## May 2026: Strict firm-owned storage audit events
- Added audit/log events: `STRICT_STORAGE_ENABLED`, `STRICT_STORAGE_DISABLED`, `STRICT_STORAGE_WRITE_BLOCKED`, `STRICT_STORAGE_BYOS_REQUIRED`.
- Event payload is sanitized and includes only: `firmId`, actor xID/user id, `requestId`, provider mode, target write path category (`client_profile`/`cfs_upload`/`direct_upload`), and timestamp.
- Secrets, credentials, provider tokens, and folder IDs are excluded from strict-mode audit visibility.


### Root recovery visibility
Primary Admins now get explicit storage root health status in Storage Settings and workspace badge warnings when Google Drive root verification fails (`STORAGE_ROOT_MISSING`, `STORAGE_MANIFEST_MISSING`, `STORAGE_ROOT_MISMATCH`).


## Implemented vs legacy vs roadmap
- Implemented today (2026-05-22): BYOS-first storage routing, strict firm-owned mode, and cloud object reference metadata patterns.
- Legacy exceptions: certain business narrative fields are still stored in Mongo in some collections for backward compatibility.
- Roadmap: phased externalization of CFS, docket/task narrative, comments/history, and SOP/checklist/knowledge canonical content to BYOS JSON documents.

- CFS BYOS update (2026-05-22): Client Fact Sheet business content is persisted in BYOS/managed cloud JSON and hydrated on read; strict firm-owned mode blocks writes when BYOS is unavailable.
- Added Docket cloud-first narrative storage: canonical docket JSON at firms/{firmId}/dockets/{docketId}/docket.json with Mongo retaining control metadata + docketRef/docketStorageMode, legacy Mongo read fallback when no docketRef, and safe warning docket_content_unavailable on cloud-read failure.

- Google Drive BYOS root binding is immutable by default: reconnect/refresh reuses existing bound rootFolderId and enters recovery-required state (not silent reprovision) when identity checks fail.

- Task narrative BYOS update (2026-05-24): canonical task narrative payload now written to cloud JSON and hydrated on reads via `taskRef`; on cloud-read failure API returns safe `task_content_unavailable` warning. Transitional: legacy Mongo description compatibility remains.

- Comments and docket history descriptions now follow cloud-first canonical storage with strict firm-owned enforcement; legacy Mongo narrative columns are transitional read fallback only for records without refs.


## Current status table (2026-05-24)

| Area | Cloud-first canonical write | Cloud read hydration | Mongo legacy fields retained | Strict mode enforced | Next action |
|---|---|---|---|---|---|
| Client profile | Yes | Yes | Yes (transitional compatibility) | Yes | Remove remaining legacy business-profile compatibility writes. |
| CFS | Yes | Yes | Yes (transitional compatibility) | Yes | Complete compatibility read retirement after migration window. |
| Docket narrative | Yes | Yes | Yes (legacy fallback for no-ref records) | Yes | Backfill cloud refs and remove fallback narrative dependence. |
| Task narrative | Yes | Yes | Yes (transitional compatibility) | Yes | Remove transitional Mongo description compatibility path. |
| Comments/history | Yes | Yes | Yes (transitional compatibility) | Yes | Finish history/comment ref backfill and remove legacy text reliance. |
| Attachments | Yes (cloud object refs) | Yes | Minimal metadata only | Yes | Continue ref-only metadata posture and regression coverage. |
| SOP/checklist/knowledge | Not fully yet | Partial/legacy | Yes | Partial | Implement canonical cloud-first write paths and migration. |
| Billing/auth/control-plane | Not applicable | Not applicable | Required canonical control-plane fields | Not applicable | Keep strict metadata-only model and audit guardrails. |
