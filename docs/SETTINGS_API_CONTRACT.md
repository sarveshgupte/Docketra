# Settings API Contract

This document describes the read/write API contracts for the four Settings child pages:
**Firm Settings**, **Work Settings**, **Storage Settings**, and **AI Settings**.

---

## Route mounting summary

| Base path | Router file | Mount middleware |
|---|---|---|
| `/api/admin/*` | `src/routes/admin.routes.js` | `adminTenantScopedApiAccess` (auth + firmContext + requireAdmin) |
| `/api/settings/*` | `src/routes/settings.routes.js` | `tenantScopedApiAccess` (auth + firmContext) |
| `/api/work-types` | `src/routes/workType.routes.js` | `tenantScopedApiAccess` (auth + firmContext) |
| `/api/storage/*` | `src/routes/storage.routes.js` | `authenticate + firmContext + requireTenant + tenantThrottle + invariantGuard` |
| `/api/ai/*` | `src/routes/ai.routes.js` | `authenticate + firmContext + requireTenant + tenantThrottle + invariantGuard` |

---

## Read endpoints

### Firm Settings page

| Method | Path | Permission | Empty-state response |
|---|---|---|---|
| `GET` | `/api/admin/firm-settings` | `PRIMARY_ADMIN` / `ADMIN` (read) | `200` `{ success: true, data: { firm: {...defaults}, work: {...defaults} } }` |
| `GET` | `/api/admin/firm-settings/activity` | `PRIMARY_ADMIN` / `ADMIN` (read) | `200` `{ success: true, data: [] }` |

Response shape for `GET /api/admin/firm-settings`:
```json
{
  "success": true,
  "data": {
    "firm": {
      "name": "",
      "timezone": "UTC",
      "currency": "USD",
      "primaryLanguage": "en"
    },
    "work": {
      "defaultPriority": "MEDIUM",
      "maxActiveDockets": 0,
      "autoAssign": false
    }
  }
}
```

No secrets are present in this response.

---

### Work Settings page

| Method | Path | Permission | Empty-state response |
|---|---|---|---|
| `GET` | `/api/admin/cms-intake-settings` | `PRIMARY_ADMIN` / `ADMIN` (read) | `200` with `intake` defaults and `options: { workbaskets: [], categories: [], priorities: [], assignees: [] }` |
| `GET` | `/api/admin/workbaskets` | `PRIMARY_ADMIN` / `ADMIN` (read) | `200` `{ success: true, data: [] }` |
| `GET` | `/api/admin/settings/audit` | `PRIMARY_ADMIN` / `ADMIN` (read) | `200` `{ success: true, data: [], pagination: {...} }` |
| `GET` | `/api/settings/audit` | Authenticated tenant user | `200` `{ success: true, data: [], pagination: {...} }` |
| `GET` | `/api/work-types` | Authenticated tenant user | `200` `{ success: true, data: [] }` |

Response shape for `GET /api/admin/cms-intake-settings`:
```json
{
  "success": true,
  "data": {
    "intake": {
      "autoCreateClient": true,
      "autoCreateDocket": true,
      "defaultCategoryId": null,
      "defaultSubcategoryId": null,
      "defaultWorkbasketId": null,
      "defaultPriority": null,
      "defaultAssignee": null,
      "intakeApiEnabled": false,
      "intakeApiKeyMasked": "••••••••"
    },
    "options": {
      "workbaskets": [],
      "categories": [],
      "priorities": ["LOW", "MEDIUM", "HIGH"],
      "assignees": []
    }
  }
}
```

**Secret masking**: `intakeApiKeyMasked` is a redacted display value. The plaintext `intakeApiKey`
is **never** returned by this endpoint; it is only revealed once (immediately after regeneration)
via `POST /api/admin/cms-intake-settings/intake-api-key/regenerate`.

---

### Storage Settings page

| Method | Path | Permission | Empty-state response |
|---|---|---|---|
| `GET` | `/api/storage/configuration` | Authenticated tenant user | `200` with `provider: 'docketra_managed'` defaults |
| `GET` | `/api/storage/ownership-summary` | `PRIMARY_ADMIN` / `ADMIN` (via `ensureFirmAdmin` in controller) | `200` with managed fallback summary |

Response shape for `GET /api/storage/configuration` (no `success` wrapper — returns config object directly):
```json
{
  "provider": "docketra_managed",
  "isConfigured": false,
  "status": "ACTIVE_MANAGED",
  "connectedEmail": null,
  "rootFolderId": null,
  "driveId": null,
  "warnings": ["Firm-owned BYOS is recommended but not required."],
  "folderPath": null,
  "createdAt": null,
  "updatedAt": null,
  "backup": {
    "enabled": false,
    "notificationRecipients": [],
    "deliveryPolicy": "link_only",
    "retentionDays": 30
  }
}
```

**Secret masking**: `refreshToken`, `accessToken`, `clientSecret`, `secretAccessKey`, and any raw
OAuth/S3 credentials are **never** returned in this response. The response only contains
safe metadata (provider name, connection status, email, folder IDs).

---

### AI Settings page

| Method | Path | Permission | Empty-state response |
|---|---|---|---|
| `GET` | `/api/ai/configuration` | `PRIMARY_ADMIN` / `ADMIN` / `MANAGER` (read) | `200` with disabled defaults |

Response shape for `GET /api/ai/configuration`:
```json
{
  "success": true,
  "configuration": {
    "enabled": false,
    "provider": "disabled",
    "model": "",
    "credentialMode": "none",
    "hasEncryptedKey": false,
    "hasCredentialRef": false,
    "features": {},
    "roleAccess": {},
    "retention": {},
    "privacy": {}
  }
}
```

**Secret masking**: `apiKey` and `encryptedKey` are **never** present in the response.
`hasEncryptedKey` (boolean) indicates whether a key is stored without revealing it.
MANAGER-level read access is intentional per current route policy.

---

## Write / mutation endpoints (PRIMARY_ADMIN only)

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| `PUT` | `/api/admin/firm-settings` | **PRIMARY_ADMIN only** | Updates firm + work settings; audits change |
| `PUT` | `/api/admin/cms-intake-settings` | **PRIMARY_ADMIN only** | Updates CMS intake defaults |
| `POST` | `/api/admin/cms-intake-settings/intake-api-key/regenerate` | **PRIMARY_ADMIN only** | Rotates the CMS intake API key; returns new plaintext key **once only** |
| `PUT` | `/api/admin/storage` | **PRIMARY_ADMIN only** | Updates BYOS storage provider config |
| `POST` | `/api/admin/storage/disconnect` | **PRIMARY_ADMIN only** | Disconnects current storage provider |
| `PUT` | `/api/ai/configuration` | **PRIMARY_ADMIN only** | Updates BYOAI config |
| `POST` | `/api/ai/test-configuration` | **PRIMARY_ADMIN only** | Tests current AI provider credentials |

ADMIN (non-primary) attempting any of these mutations receives:
```json
{ "success": false, "message": "Primary admin access required" }
```
HTTP status `403`.

---

## Empty / new-firm state

All read endpoints are safe to call on a freshly-created firm:

- `GET /api/admin/firm-settings` → returns normalised defaults (no `404`).
- `GET /api/admin/cms-intake-settings` → returns empty `options` lists and default `intake` flags.
- `GET /api/storage/configuration` → returns `provider: 'docketra_managed'` (managed fallback).
- `GET /api/ai/configuration` → returns `enabled: false`, `provider: 'disabled'`.
- All list/audit endpoints return `data: []` (never `404` for empty collections).

---

## Role access matrix

| Endpoint | PRIMARY_ADMIN | ADMIN | MANAGER | USER |
|---|---|---|---|---|
| GET firm-settings | ✓ | ✓ | ✗ | ✗ |
| PUT firm-settings | ✓ | ✗ | ✗ | ✗ |
| GET cms-intake-settings | ✓ | ✓ | ✗ | ✗ |
| PUT cms-intake-settings | ✓ | ✗ | ✗ | ✗ |
| POST cms-intake regenerate key | ✓ | ✗ | ✗ | ✗ |
| GET workbaskets | ✓ | ✓ | ✗ | ✗ |
| GET settings/audit | ✓ | ✓ | ✓* | ✓* |
| GET work-types | ✓ | ✓ | ✓ | ✓ |
| GET storage/configuration | ✓ | ✓ | ✓ | ✓ |
| GET storage/ownership-summary | ✓ | ✓ | ✗† | ✗† |
| PUT admin/storage | ✓ | ✗ | ✗ | ✗ |
| POST admin/storage/disconnect | ✓ | ✗ | ✗ | ✗ |
| GET ai/configuration | ✓ | ✓ | ✓ | ✗ |
| PUT ai/configuration | ✓ | ✗ | ✗ | ✗ |

\* `GET /api/settings/audit` is under `tenantScopedApiAccess` (no admin role gate at route level);
access is limited to authenticated tenant users with valid firm context.  
† `getStorageOwnershipSummary` controller checks `isAdminRole` (PRIMARY_ADMIN or ADMIN) internally.

---

## Contract test

The contract is enforced by `tests/settings.routeContract.test.js`. Run with:

```bash
REDIS_URL='' node tests/settings.routeContract.test.js
```

The test verifies:
1. All read endpoints return `200` for `PRIMARY_ADMIN` and `ADMIN`.
2. `MANAGER` can read AI configuration.
3. No plaintext secrets (`refreshToken`, `accessToken`, `clientSecret`, `secretAccessKey`,
   `apiKey`, `encryptedKey`, `intakeApiKey`) appear in responses.
4. Unauthenticated requests are rejected with `401`.
5. `ADMIN` is blocked (`403`) from all write mutations.
6. `PRIMARY_ADMIN` passes the route guard for all write mutations.
7. Empty/default state responses have correct shapes (object for firm/AI, arrays for lists).

## Work Settings permission behavior (hotfix note)

Work Settings remains owned by `/api/admin/*` firm-admin endpoints. Permission evaluation:
1. Resolve request role context.
2. If required permission is missing, refresh from firm DB membership.
3. Deny if refreshed membership still lacks permission.

This protects PRIMARY_ADMIN after stale JWT/req cache drift, while preventing permission escalation for USER/MEMBER accounts.
