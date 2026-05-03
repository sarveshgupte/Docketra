# Task Manager Worklist / Workbasket Operating Model

> **Canonical reference** for all worklist, workbasket, and QC workbasket behaviour in Docketra.  
> Every service, controller, and UI surface must follow these rules.

---

## Terminology

| Term | Definition |
|---|---|
| **User Worklist** | All dockets assigned to a specific user (`assignedToXID = user.xID`) in a non-terminal active/pending/reopened state. |
| **Workbasket** | A team-scoped queue holding unassigned or routed dockets (`assignedToXID = null`, `queueType = GLOBAL`). Each workbasket is a `Team` document with `type = 'PRIMARY'`. |
| **QC Workbasket** | A child workbasket (`type = 'QC'`) linked to exactly one PRIMARY workbasket via `parentWorkbasketId`. Holds dockets in the quality-control stage. |
| **All Dockets** | The firm-scoped complete set of all non-deleted dockets, including terminal RESOLVED and FILED records. Used only in archive/reporting views. |

---

## Canonical Field Mapping (Case / Docket)

| Field | Purpose |
|---|---|
| `assignedToXID` | xID of the user who owns the docket. `null` when in a workbasket queue. |
| `ownerTeamId` | The PRIMARY workbasket the docket was created/routed to. Immutable after creation. |
| `routedToTeamId` | The current workbasket the docket is sitting in when it is in the workbasket queue or QC stage. |
| `state` | Canonical lifecycle position: `IN_WB` · `IN_PROGRESS` · `IN_QC` · `PENDED` · `RESOLVED` · `FILED` |
| `queueType` | `GLOBAL` (in workbasket) or `PERSONAL` (in a user's worklist). |
| `status` | Detailed status value (see CaseStatus). |
| `pendingUntil` / `reopenAt` | Only set when `state = PENDED`. Cleared when docket re-opens. |

---

## 15 Canonical Product Rules

1. **Every active user must have a personal Worklist.** This is query-based: `assignedToXID = user.xID`. No separate Worklist collection is required.

2. **Every team/workbasket created by admin/primary admin must be a PRIMARY workbasket.**  
   `Team.type = 'PRIMARY'` is the default when creating a workbasket via the team API.

3. **Users can be linked to HR, Legal, Ops, or any custom team/workbasket.**  
   `User.teamIds` holds all workbasket memberships; `User.teamId` is the primary one.

4. **Each PRIMARY workbasket must have exactly one linked QC workbasket.**  
   When a PRIMARY workbasket is created, the API auto-creates a `Team` with `type = 'QC'` and `parentWorkbasketId = primaryTeam._id`. The MongoDB partial unique index on `{firmId, parentWorkbasketId, type: 'QC'}` enforces uniqueness.

5. **The QC workbasket must reference its parent PRIMARY workbasket.**  
   `Team.parentWorkbasketId` is required for all QC teams and must point to an active PRIMARY team within the same firm.

6. **The manager of a PRIMARY workbasket is automatically linked to its QC workbasket.**  
   On `createTeam` and `updateTeam`, if a `managerId` is provided, the manager's `User.teamIds` is updated to include the QC workbasket's `_id`.

7. **Admin/primary admin/manager can add other users to the QC workbasket.**  
   `POST /api/teams/:id/qc/add-user` is available to any actor with the `TEAM_MANAGE` permission **or** the manager of the linked PRIMARY workbasket.

8. **Every active non-superadmin user must be linked to at least one PRIMARY workbasket.**  
   Enforced as a product convention; `User.teamIds` must be non-empty for active non-superadmin users.

9. **Dockets created under a category/subcategory are routed to that subcategory's mapped PRIMARY workbasket.**  
   `Category.subcategories[].workbasketId` (required) is read at docket creation time. The resolved `workbasketId` is written to `Case.ownerTeamId`.

10. **Newly created unassigned dockets sit in the mapped workbasket queue, not in a user Worklist.**  
    `state = IN_WB`, `queueType = GLOBAL`, `assignedToXID = null`, `status = UNASSIGNED`.

11. **A user pulls a docket from a workbasket into their own Worklist.**  
    The `POST /cases/pull` endpoint calls `pullCaseFromWorkbasket()` which atomically:
    - Sets `assignedToXID = user.xID`
    - Sets `status = ASSIGNED`, `state = IN_PROGRESS`, `queueType = PERSONAL`
    - Creates an audit entry

12. **Pended dockets remain owned by the same assigned user.**  
    `assignedToXID` is **not** cleared when a docket is pended. `pendingUntil` / `reopenAt` is set. When the date elapses, the docket auto-reopens into the same user's Worklist via `autoReopenExpiredPendingCases()`.

13. **If a user is deactivated/disabled/deleted, all non-terminal dockets are moved back to the PRIMARY workbasket.**  
    `handleUserDeactivation()` in `docketWorkflow.service.js` clears `assignedToXID`, sets `state = IN_WB`, `queueType = GLOBAL`, `status = AVAILABLE`, and clears `pendingUntil`/`reopenAt`. Terminal states (`RESOLVED`, `FILED`) are excluded.

14. **RESOLVED and FILED dockets must not appear in any user Worklist or workbasket queue.**  
    Both the employee worklist query and the global worklist query explicitly exclude `RESOLVED` and `FILED` via `status: { $nin: [...] }`.

15. **Tenant isolation and xID-based ownership are preserved at all times.**  
    Every query is wrapped with `enforceTenantScope()`. All ownership fields use `xID` format (`X123456`), never email.

---

## Query Definitions

### My Worklist (User Worklist)
```
GET /api/worklists/employee/me
```
```js
{
  firmId: req.user.firmId,          // tenant scope
  assignedToXID: user.xID,          // owned by this user
  status: {
    $in: [ASSIGNED, IN_PROGRESS, OPEN, QC_PENDING]
    // excludes PENDING, RESOLVED, FILED
  }
}
```

### Workbasket Queue (PRIMARY or QC)
```
GET /api/worklists/global?workbasketId=<teamId>
```
```js
{
  firmId: req.user.firmId,
  assignedToXID: null,              // unassigned
  ownerTeamId: selectedTeamId,      // scoped to selected workbasket
  status: {
    $in: [OPEN, UNASSIGNED, RETURNED]
    // excludes RESOLVED, FILED
  }
}
```

### All Dockets (Terminal Archive)
Admin-only view. No status filter — includes RESOLVED and FILED records.

---

## Team (Workbasket) API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/teams` | List all active workbaskets for the firm |
| `POST` | `/api/teams` | Create PRIMARY workbasket (also auto-creates QC WB) |
| `PATCH` | `/api/teams/:id` | Update name or manager |
| `POST` | `/api/teams/:id/assign-user` | Link a user to a workbasket |
| `POST` | `/api/teams/:id/qc/add-user` | Add a user to the QC workbasket |

### `POST /api/teams` — Create PRIMARY Workbasket

**Request**
```json
{
  "name": "Legal",
  "managerId": "<User._id>"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "team": { "_id": "...", "type": "PRIMARY", "name": "Legal", ... },
    "qcTeam": { "_id": "...", "type": "QC", "name": "Legal – QC", "parentWorkbasketId": "...", ... }
  }
}
```

---

## Docket Lifecycle State Machine

```
                    ┌──────────────┐
  create ──────────►│    IN_WB     │ (workbasket queue)
                    └──────┬───────┘
                           │ pull (user claims)
                    ┌──────▼───────┐
                    │ IN_PROGRESS  │ (user worklist)
                    └──┬───────┬───┘
             pend       │       │ send to QC / force QC
                    ┌───▼───┐  ┌▼────────┐
                    │ PENDED│  │  IN_QC  │
                    └───┬───┘  └──┬──────┘
         reopen         │  QC pass│ QC fail
                    ────┘      ┌──▼──────────┐
                               │ IN_PROGRESS │ (back to user)
                               └──┬──────────┘
                                  │ resolve
                           ┌──────▼──────┐
                           │  RESOLVED   │ (terminal)
                           └──────┬──────┘
                                  │ file
                           ┌──────▼──────┐
                           │   FILED     │ (terminal, read-only)
                           └─────────────┘
```

**Rules at each transition:**

- `IN_WB → IN_PROGRESS`: Only via pull API. Sets `assignedToXID`, `queueType = PERSONAL`.
- `IN_PROGRESS → PENDED`: Mandatory comment + reopenDate required. `assignedToXID` **kept**.
- `PENDED → IN_PROGRESS`: Auto-reopen on `reopenAt` elapsed, or admin manual reopen.
- `IN_PROGRESS → IN_QC`: Docket routed to QC workbasket (`routedToTeamId = qcTeam._id`).
- `IN_QC → IN_PROGRESS`: QC fail returns to original assignee.
- `IN_QC → RESOLVED`: QC pass.
- `IN_PROGRESS → RESOLVED`: Mandatory comment required.
- `RESOLVED → FILED`: Admin only. Mandatory reason + note.
- **User deactivation**: All non-terminal dockets reset to `IN_WB`.

---

## Schema Enforcement Points

| Rule | Enforced in |
|---|---|
| Subcategory `workbasketId` required | `Category.model.js` – `subcategorySchema.workbasketId.required = true` |
| QC WB unique per PRIMARY | `Team.model.js` – partial unique index on `{firmId, parentWorkbasketId, type: 'QC'}` |
| Auto-create QC WB | `team.controller.js` – `createTeam()` |
| Manager auto-linked to QC WB | `team.controller.js` – `createTeam()`, `updateTeam()` |
| Docket routed to mapped WB on create | `caseCreate.service.js` – reads `subcategoryDoc.workbasketId` |
| Pull sets canonical fields | `caseAssignment.service.js` – `pullCaseFromWorkbasket()` |
| Pending keeps `assignedToXID` | `caseAction.service.js` – `pendCase()` does not clear `assignedToXID` |
| Deactivation resets dockets | `docketWorkflow.service.js` – `handleUserDeactivation()` |
| Terminal states excluded from WL/WB | `search.controller.js` – `employeeWorklist()`, `globalWorklist()` |
| Tenant scope on all queries | `utils/tenantScope.js` – `enforceTenantScope()` wrapper |
