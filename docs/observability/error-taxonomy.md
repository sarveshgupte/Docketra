# Operational error taxonomy

Primary operational codes for triage:

- `STORAGE_NOT_AVAILABLE`
- `STORAGE_NOT_CONNECTED`
- `UPLOAD_SESSION_EXPIRED`
- `UPLOAD_VERIFICATION_FAILED`
- `UPLOAD_CHECKSUM_MISMATCH`
- `UPLOAD_SESSION_BACKEND_UNAVAILABLE`
- `UPLOAD_SESSION_NOT_FOUND`
- `TENANT_SCOPE_TAMPERING_DETECTED`
- `CASE_ACCESS_DENIED`
- `CLIENT_ACCESS_RESTRICTED`
- `CACHE_HYDRATION_FAILED`

Defined in backend at `src/constants/operationalErrorCodes.js` and mirrored in frontend handling (`ui/src/utils/constants.js`).

## Handling guidance
- `UPLOAD_*` failures: check intent + finalize events with shared correlation id.
- `STORAGE_*` failures: verify firm storage connectivity and provider mode.
- `TENANT_SCOPE_*`/access failures: validate firm context and role scope.
