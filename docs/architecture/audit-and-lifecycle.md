# Audit and Lifecycle Integrity

## Canonical docket audit event shape

Docketra now enforces a normalized canonical audit shape for docket lifecycle events:

```json
{
  "entityType": "docket",
  "entityId": "CASE-20260423-00001",
  "docketId": "CASE-20260423-00001",
  "firmId": "FIRM-1",
  "event": "STATE_CHANGED",
  "action": "STATE_CHANGED",
  "fromState": "IN_PROGRESS",
  "toState": "QC_PENDING",
  "actorId": "X100",
  "actorRole": "ADMIN",
  "reasonCode": "AUTO_REOPEN_DUE",
  "metadata": {
    "requestId": "...",
    "source": "docketWorkflow.service.writeAudit"
  },
  "createdAt": "2026-04-23T00:00:00.000Z"
}
```

Notes:
- `actorId/actorRole` mirror legacy `userId/userRole` for backward compatibility.
- `event` and `action` are kept aligned.
- `reasonCode` is first-class for diagnostics and post-mortems.
- Metadata source labels now use canonical service-owned values (for example `docket.audit`, `docket.audit.legacy_bridge`) to reduce drift.
- Canonical fields (`reasonCode`, `fromState`, `toState`, actor ids) are stored as top-level fields; metadata should avoid duplicating them.

## Docket lifecycle stages and expected audit events

1. **Created / Workbasket (`IN_WB`)**
   - Expected events: `CREATED`, category/subcategory snapshot metadata, routing metadata, origin linkage metadata.
2. **Assigned / In progress (`IN_PROGRESS`)**
   - Expected events: `ASSIGNMENT`/`REASSIGNED`, `STATE_CHANGED`.
3. **Pending (`PEND`)**
   - Expected events: `STATE_CHANGED` with reason/comment.
4. **QC (`IN_QC`)**
   - Expected events: `STATE_CHANGED` to QC, then `QC_ACTION` (`QC_PASSED`, `QC_CORRECTED`, `QC_FAILED`).
5. **Resolved / Filed (`RESOLVED`, `FILED`)**
   - Expected events: `STATE_CHANGED` and terminal metadata.
6. **Reopen / rollback**
   - Expected events: `PENDING_REOPEN` with explicit reason code (`AUTO_REOPEN_DUE`) and state reset to Workbench (`IN_WB` / available queue).

## CRM/CMS → Client → Docket traceability

Expected linkage chain:

- **CMS intake**: submission metadata + lead id
- **Lead**: identifies conversion outcome (`clientId`, `docketId`, warnings)
- **Client**: canonical `clientId`
- **Docket**: audit metadata includes source and upstream reference ids (`leadId`, `clientId`, idempotency key where present)

This enables answering: “Which intake created this docket and through which client resolution path?”

## Transition integrity rules

- Transitions must pass lifecycle/state-machine validation.
- Invalid transitions are rejected with explicit error codes.
- No direct state transitions should bypass audit writing.
- Concurrency-sensitive transitions use version checks / transactional updates where available.
- Auto-reopen from `PENDING` re-enters workbasket (`AVAILABLE` / `IN_WB`) to avoid invalid ownerless `IN_PROGRESS` state.

## Admin audit coverage

Admin audit action taxonomy includes:
- `USER_CREATED`, `USER_INVITED`
- `ROLE_UPDATED`
- `USER_ACTIVATED`, `USER_DEACTIVATED`
- `USER_UNLOCKED`, `USER_PASSWORD_RESET`
- `WORKBENCH_CONFIG_UPDATED`
- `CATEGORY_CONFIG_UPDATED`
- `HIERARCHY_UPDATED`

## Known limitations

- Legacy audit readers may still consume mixed legacy/canonical fields (`userId` vs `actorId`).
- Some historical rows predate normalized `entityType/entityId/action/reasonCode` and may not backfill automatically.
- Audit writes are intentionally non-blocking in selected non-critical paths to preserve availability; monitoring should alert on write failures.
