# BYOS Regression Audit

## What was tested
- Provider-neutral docket attachment persistence and runtime provider resolution (`docketFileStorage.service`, factory-backed).
- Backup job creation/update metadata boundaries (no archive bytes persisted to MongoDB fields).
- Middleware/runtime path resolution through `StorageProviderFactory`.
- Storage state normalization and drift behavior, including legacy aliases and managed fallback.
- Credential/log redaction checks against common secrets and token names.

## Data boundary guarantee
The coverage verifies attachment and backup persistence writes provider-neutral metadata only, and explicitly rejects persistence of raw file/binary payload keys such as:
- `buffer`, `fileBuffer`, `content`, `binary`, `base64`, `rawPayload`
- `zipPayload`, `archiveBytes`

## Credential redaction guarantee
Tests assert that common credential-bearing fields are not emitted in captured runtime log payloads:
- `refreshToken`, `googleRefreshToken`, `accessToken`
- `secretAccessKey`, `sessionToken`

## Provider resolution guarantee
Runtime paths are exercised to confirm provider resolution through `StorageProviderFactory` for:
- attachment upload/list/download
- backup run path
- active-storage middleware

## Known remaining limitations
- The audit focuses on regression/security coverage and does not alter onboarding/auth flows.
- Signed URLs are validated by existing path-specific tests; this audit does not broaden endpoint-level URL policy.

## Commands used
- `npm run test:byos`
- `npm test`
