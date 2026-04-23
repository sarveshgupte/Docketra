# Workflow diagnostics

## Correlation id pattern
- Frontend creates an `X-Correlation-ID` per API workflow in `ui/src/services/api.js`.
- Backend accepts and re-emits it in `src/middleware/requestId.middleware.js` and includes it in structured workflow logs.
- If absent, backend falls back to `requestId`.

## Structured backend events
- `DOCKET_DETAIL_LOAD`
- `CLIENT_DETAIL_LOAD`
- `DIRECT_UPLOAD_INTENT`
- `DIRECT_UPLOAD_FINALIZE`
- `CLIENT_CFS_UPLOAD_INTENT`
- `CLIENT_CFS_UPLOAD_FINALIZE`
- `DOCKET_COMMENT_MUTATION`
- `DOCKET_STATUS_MUTATION`
- `CLIENT_FACT_SHEET_MUTATION`

## Safe log fields
- `event`, `workflow`, `route`
- `firmId`, `actorXID`
- `caseId`, `clientId`, `uploadId`
- `provider`, `providerMode`
- `outcome`, `durationMs`, `errorCode`
- `correlationId`

## Must never be logged
- Raw document contents
- CFS payloads / client profile full object
- Auth tokens or cookies
- File body bytes

## Frontend diagnostics
- Route transitions and durations (`ui/src/utils/performanceMonitor.js`)
- API duration and slow API warnings (`ui/src/services/api.js`)
- Duplicate in-flight request storm warnings (deduped)
- Dev/internal diagnostics panel behind `localStorage['docketra:diagnostics:panel']='enabled'`
