# BYOS Live QA Checklist

Date: 2026-05-24  
Audience: Primary Admin + QA  
Scope: Validate Google Drive BYOS root identity, strict firm-owned storage enforcement, and cloud-first transitional writes.

## Preconditions
- Firm workspace exists with Primary Admin access.
- Storage Settings page is reachable.
- Test user can create/update clients, dockets, tasks, and comments.
- Strict mode toggle is visible to Primary Admin.

## Live QA Steps

1. **Connect Google Drive**
   - From **Storage Settings**, click **Connect firm Google Drive** and complete OAuth.
   - Expect status to become active BYOS with no secret exposure in UI/API.

2. **Confirm one root folder**
   - Verify only one canonical Docketra root is bound for the firm.
   - Confirm root identity uses folder ID + manifest, not folder name alone.

3. **Confirm reconnect does not create duplicate root**
   - Run reconnect/refresh flow.
   - Verify existing bound root is reused and no duplicate root folder is silently created.

4. **Rename folder and verify still healthy**
   - Rename the bound root folder in Drive.
   - Click **Recheck storage**.
   - Expect healthy/renamed-valid state (identity still valid).

5. **Delete/trash folder and verify recovery-required**
   - Trash/delete the bound root in Drive.
   - Click **Recheck storage**.
   - Expect recovery-required state (`STORAGE_ROOT_MISSING` or equivalent).

6. **Enable strict mode**
   - In Storage Settings, enable **Strict firm-owned storage mode**.
   - Expect strict-mode state and audit visibility to update.

7. **Create/update client profile**
   - Create a client, then edit profile fields.
   - Expect canonical new writes to persist cloud-first (selected domains) with legacy Mongo compatibility retained during transition.

8. **Create/update CFS**
   - Save CFS content for the same client.
   - Expect CFS cloud JSON write and successful read hydration.

9. **Create docket**
   - Create a docket with narrative/business description content.
   - Expect docket narrative canonical write to cloud JSON.

10. **Create/update task**
    - Create a task with description, then update it.
    - Expect task narrative canonical write to cloud JSON and read hydration.

11. **Add comment**
    - Add a docket comment.
    - Expect comment canonical write to cloud JSON.

12. **View docket history**
    - Open docket history/audit timeline.
    - Expect history narrative hydration from cloud refs (legacy fallback only for non-migrated records).

13. **Confirm cloud files appear under expected paths**
    - Validate cloud paths (as applicable):
      - `firms/{firmId}/clients/{clientId}/profile/profile.json`
      - `firms/{firmId}/clients/{clientId}/cfs/cfs.json`
      - `firms/{firmId}/dockets/{docketId}/docket.json`
      - `firms/{firmId}/tasks/{taskId}/task.json`
      - `firms/{firmId}/dockets/{docketId}/comments/{commentId}.json`
      - `firms/{firmId}/dockets/{docketId}/history/{historyId}.json`

14. **Confirm strict mode blocks writes when root invalid**
    - While strict mode is enabled, force root invalid/recovery-required state.
    - Retry business-content write (client/CFS/docket/task/comment).
    - Expect write blocked (`STRICT_STORAGE_WRITE_BLOCKED` / BYOS required) until root health is restored.

## Pass criteria
- No duplicate BYOS root on reconnect.
- Root rename does not break healthy state when ID+manifest match.
- Root deletion/manifest failure transitions to recovery-required.
- Strict mode consistently blocks business-content writes when BYOS root is invalid.
- Canonical new writes are cloud-first for selected domains, with legacy Mongo compatibility retained during transition.
