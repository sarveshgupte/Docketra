# DATA RESIDENCY FULL AUDIT — 2026-05

Date: 2026-05-22

## Executive summary
Current state is **partially compliant**. MongoDB still contains legacy firm business-content fields in several collections (notably Client, Case/Docket, Task, Comment, and Knowledge models). BYOS-first is implemented for major file/profile pathways, but canonical narrative/business content is not fully externalized yet.

## Classification matrix
| Model/Collection | Current Mongo fields (high-level) | Classification | Action | Priority |
|---|---|---|---|---|
| Client | ids, firmId, status, plus `businessName`, `businessEmail`, contacts, tax IDs, `clientFactSheet`, notes/comments | temporary legacy exception | needs migration → BYOS JSON + Mongo refs only | P0 sensitive |
| ClientFactSheet (in Client) | basicInfo + description/notes/docs/comments | temporary legacy exception | move to `firms/{firmId}/clients/{clientId}/cfs/cfs.json`; store reference only | P0 sensitive |
| Attachment | file metadata refs + description | mixed (mostly control-plane + legacy metadata text) | keep metadata; store reference only for cloud objects | P1 business content |
| CaseFile | upload/session metadata + description/note | temporary legacy exception | keep upload control-plane, remove narrative text | P1 business content |
| Case/Docket | lifecycle/routing/status + `description`, checklist/SOP snapshot, legacy client snapshot fields | temporary legacy exception | move canonical docket narrative to `firms/{firmId}/dockets/{docketId}/docket.json` | P0 sensitive |
| Task/Worklist/Workbasket task docs | status/assignee + `description` | temporary legacy exception | move canonical task narrative to `firms/{firmId}/tasks/{taskId}/task.json` | P1 business content |
| Comments/Notes/History | comment text/body and history descriptions | temporary legacy exception | move canonical comments to `firms/{firmId}/dockets/{docketId}/comments/{commentId}.json` | P1 business content |
| SOP/Checklist/Knowledge Library | content/description fields in knowledge/work schemas | temporary legacy exception | move canonical SOP/checklist/knowledge docs to BYOS | P1 business content |
| Firm/User/Auth/Audit | firm id/name/slug/status, users, roles, sessions, audit ids | allowed control-plane | keep in Mongo | P2 metadata cleanup |
| Storage config/backup metadata | provider routing/status, usage, health, backup jobs | allowed control-plane | keep in Mongo | P2 metadata cleanup |

## Implemented vs legacy vs planned
- Implemented cloud-first:
  - Client profile BYOS path and strict storage controls exist.
  - Attachments use cloud object storage references.
- Current legacy exceptions:
  - Business narrative fields remain in Mongo in Client/Case/Task/Comment/Knowledge paths.
- Planned migration:
  - Externalize CFS, docket narrative, task narrative, comments/history notes, SOP/checklist/knowledge docs.

## Repository/service guardrails added
- Added a shared Mongo write guard service to block prohibited business-content keys on new writes where practical.
- Applied guard on task creation and case create/update write paths.

## Phased cloud-first roadmap
1. **Phase 1 (Client profiles)**: Confirmed partially implemented cloud-first behavior; complete removal of legacy Client business fields from Mongo.
2. **Phase 2 (CFS JSON)**: Canonical CFS in `firms/{firmId}/clients/{clientId}/cfs/cfs.json`.
3. **Phase 3 (Docket/task narratives)**: Canonical content in:
   - `firms/{firmId}/dockets/{docketId}/docket.json`
   - `firms/{firmId}/tasks/{taskId}/task.json`
4. **Phase 4 (Comments/history)**: Canonical content in `firms/{firmId}/dockets/{docketId}/comments/{commentId}.json`.
5. **Phase 5 (SOP/checklist/knowledge)**: Canonical SOP/checklist/knowledge docs in BYOS.

## Acceptance statement
Yes — firm business-content fields still exist in MongoDB today, and they are documented as temporary legacy exceptions with migration phases and removal targets in guardrail tests.

- Update 2026-05-22: CFS is now cloud-first (`firms/{firmId}/clients/{clientId}/cfs/cfs.json`) with Mongo pointer-only metadata and temporary legacy read fallback.
\n- Added Docket cloud-first narrative storage: canonical docket JSON at firms/{firmId}/dockets/{docketId}/docket.json with Mongo retaining control metadata + docketRef/docketStorageMode, legacy Mongo read fallback when no docketRef, and safe warning docket_content_unavailable on cloud-read failure.
