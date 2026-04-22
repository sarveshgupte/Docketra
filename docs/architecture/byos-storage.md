# BYOS Storage Architecture (Client Profile Offloading)

## Objective
Docketra MongoDB stores only minimal workflow metadata for clients. Full client profile payloads are stored in the active storage backend:
- firm-connected provider (Google Drive, etc.)
- Docketra-managed fallback storage (S3-backed) when firm storage is unavailable

## Client Data Boundary
### Allowed in Mongo (`Client`)
- `_id`, `firmId`, `clientId`
- `businessName` (display/index)
- `status`, `isActive`, system flags
- `profileRef` pointer metadata (`provider`, `mode`, `fileId/objectKey`, `checksum`, `version`, timestamps)

### Not allowed in Mongo (migrated to profile object)
- PAN/CIN/GST/TAN
- addresses
- detailed contact person attributes
- client fact sheet notes/description/basic info/comments
- other rich profile payload fields

## Enforcement guarantees
- `PAN`, `TAN`, `GST`, `CIN`, `businessAddress`, `secondaryContactNumber`, `contactPerson*`, and `clientFactSheet` are **hydration-only API fields**.
- Any write attempt for these fields to Mongo is blocked by schema/repository enforcement with `BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED`.
- API responses may still include these properties after profile hydration, but Mongo is not the source of truth.

## Storage-backed profile object
Stored as versioned JSON:

```json
{
  "schemaVersion": 1,
  "clientId": "C000123",
  "firmId": "...",
  "profileVersion": 3,
  "updatedAt": "2026-04-22T00:00:00.000Z",
  "updatedBy": "X123456",
  "profile": {
    "legalName": "...",
    "identifiers": { "pan": null, "gstin": null, "tan": null, "cin": null },
    "contacts": { "primaryEmail": null, "primaryPhone": null, "secondaryPhone": null, "contactPerson": {} },
    "addresses": { "businessAddress": null },
    "factSheet": {},
    "customFields": {}
  }
}
```

## Service entry points
`src/services/clientProfileStorage.service.js`
- `createClientProfile`
- `getClientProfile`
- `updateClientProfile`
- `deleteClientProfile`
- `migrateClientProfileToStorage`

All storage access requires firm context and tenant-scoped keys/folders.

## Fallback mode requirements
Managed fallback uses S3 via env:
- `MANAGED_STORAGE_S3_BUCKET`
- `MANAGED_STORAGE_S3_REGION`
- optional credentials/prefix

Without these, profile writes fail closed with `STORAGE_NOT_CONNECTED`.

## Read-path guarantee
- Profile reads resolve by `Client.profileRef` metadata, not by tenant “currently active provider” alone.
- Managed-fallback (`provider: docketra_managed`) profile objects remain readable even after a firm later connects an external provider.
