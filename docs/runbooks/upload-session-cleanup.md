# Upload Session Cleanup Runbook

## Purpose
Direct-upload session rows are temporary control-plane records. They should not accumulate forever once they reach terminal states.

## Cleanup mechanism
- `CaseFile.cleanupAt` is populated when session status becomes:
  - `verified`
  - `failed`
  - `abandoned`
- MongoDB TTL index (`expireAfterSeconds: 0`) on `cleanupAt` handles asynchronous deletion.

## Retention policy
- Controlled by `DIRECT_UPLOAD_RETENTION_MS`.
- Default retention: 30 days.
- `initiated` / `uploaded` sessions are not TTL-targeted until they move to a terminal state.

## Operational notes
- TTL cleanup is asynchronous (Mongo background TTL monitor); deletion timing is not exact to the second.
- Keep retention aligned with audit/compliance requirements before lowering it in production.
- If a session is `verified`, attachment metadata remains canonical in `Attachment`; deleting terminal session rows does not delete provider bytes.
