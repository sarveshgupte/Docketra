# Canonical Docket Lifecycle & Workflow Tree Specification

This document serves as the **authoritative blueprint** for Docketra's Docket Lifecycle State Machine, Transition Tree, and Mandatory Business Rules.

---

## 1. Complete Docket Lifecycle Workflow Tree

```mermaid
graph TD
    %% Creation & Unassigned WB
    START([Start / Docket Created]) --> OPEN[1. OPEN\nLocation: Workbasket WB\nUnassigned]
    
    %% Filed Branch
    OPEN -->|User Action: Cancel/Error\nCompulsory Comment| FILED[6. FILED\nTerminal Archive\nCannot be Reopened]
    FILED -.->|Admin Action: Clone Docket| CLONED[New Docket Created\nCopies Comments & Attachments]
    CLONED --> OPEN

    %% Pulling to Worklist
    OPEN -->|User Action: Pull to WL\nCompulsory Comment| ASSIGNED[2. ASSIGNED\nLocation: User Worklist WL]

    %% Actions from ASSIGNED
    ASSIGNED -->|User Action: Pend\nCompulsory Comment +\nCompulsory Date/Time| PEND[3. PEND\nLocation: User WL\nPaused]
    PEND -->|System Auto-Reopen Date/Time\nOR Client Reply/Upload| ASSIGNED

    ASSIGNED -->|User Action: Cancel/Error\nCompulsory Comment| FILED

    %% Routing Sub-Tree
    ASSIGNED -->|User Action: Route to Dept B\nCompulsory Comment| ROUTED[4. ROUTED\nLocation: Target Dept WB]
    ROUTED -->|Dept B User: Pull to WL\nCompulsory Comment| ROUTED_ASSIGNED[5a. ROUTED_ASSIGNED\nLocation: Dept B User WL]
    
    ROUTED_ASSIGNED -->|Dept B User: Pend\nCompulsory Comment +\nCompulsory Date/Time| ROUTED_PEND[5b. ROUTED_PEND\nLocation: Dept B User WL]
    ROUTED_PEND -->|Auto-Reopen Date/Time\nOR Info Received| ROUTED_ASSIGNED

    ROUTED_ASSIGNED -->|Dept B User: Complete\nCompulsory Comment| ROUTED_SUBMITTED[5c. ROUTED_SUBMITTED\nLocation: Originating User WL]
    ROUTED_SUBMITTED --> ASSIGNED

    %% Resolution & QC Sub-Tree
    ASSIGNED -->|User Action: Resolve\nCompulsory Comment\n[QC Disabled]| RESOLVED[7. RESOLVED\nTerminal Success]
    
    ASSIGNED -->|User Action: Resolve\nCompulsory Comment\n[QC Enabled]| QC_WB[8. QC_WB\nLocation: QC Workbasket]
    QC_WB -->|QC Reviewer: Pull to WL\nCompulsory Comment| QC_ASSIGNED[9. QC_ASSIGNED\nLocation: QC Reviewer WL]

    %% QC Outcomes
    QC_ASSIGNED -->|QC Outcome: Pass\nNo Comment Required| RESOLVED
    QC_ASSIGNED -->|QC Outcome: Fail\nCompulsory Comment| QC_FAIL_RETURN[QC_FAIL]
    QC_FAIL_RETURN -->|Routes Back to Original User| ASSIGNED
    
    QC_ASSIGNED -->|QC Outcome: Corrected on Spot\nCompulsory Comment| RESOLVED
```

---

## 2. Compulsory Business Rules Matrix

| Rule # | Category | Rule Description | Enforced By |
| :--- | :--- | :--- | :--- |
| **R1** | **Mandatory Comments** | **Compulsory Comment on ALL State Changes**: Every single user action that alters the lifecycle of a docket requires a non-empty comment. | Backend API Validation (`400 BAD_REQUEST`) |
| **R2** | **Comment Exception** | **Single Exception**: Transition from `QC_ASSIGNED` → `RESOLVED` via **`QC_PASS`** does NOT require a comment. | Backend State Machine |
| **R3** | **Compulsory Pend Schedule** | **Mandatory Date & Time for PENDING**: Moving a docket to `PEND` or `ROUTED_PEND` requires a compulsory `reopenAt` timestamp in addition to a comment. | Backend & UI Datepicker |
| **R4** | **Single-Level Routing** | **Strict 1-Level Routing Depth**: A routed user (`ROUTED_ASSIGNED`) CANNOT route the docket to a 3rd department. To involve Dept C, Dept B must submit back to Dept A (`ROUTED_SUBMITTED`) with a comment requesting routing to Dept C. Dept A then routes to Dept C. | Backend API Guardrail |
| **R5** | **No Direct Resolve on Routed** | **No Direct Filing/Resolution for Routed Users**: A target routed user CANNOT mark a docket as `FILED` or `RESOLVED`. They can only mark it `ROUTED_SUBMITTED` back to the originator. | API Authorization Policy |
| **R6** | **QC Re-Review Loop** | **100% Re-inspection on Resubmission**: If a `QC_FAIL` docket is routed back to `ASSIGNED` and the original user resolves it a second time, it MUST move back to `QC_WB` for re-checking. | State Machine Transition Logic |
| **R7** | **FILED Invariance & Cloning** | **FILED is Immutable**: A `FILED` docket can NEVER be reopened under any circumstances. However, users can **Clone** a new `OPEN` docket from a `FILED` docket, which copies all historical comments and attachments into the new docket. | Case Service `cloneDocket()` |
| **R8** | **Metric Isolation** | **FILED vs RESOLVED Metrics**: Analytics dashboards must keep `FILED` (cancelled/error) counts 100% distinct from `RESOLVED` (completed work) counts. | Reporting & Analytics Engines |

---

## 3. Lifecycle State Descriptions & Allowed Transitions

### 1. `OPEN`
* **Definition**: Created and placed in a Workbasket (WB). Unassigned. All dockets start here.
* **Allowed Next States**: `ASSIGNED`, `FILED`.

### 2. `ASSIGNED`
* **Definition**: Pulled from WB into a user's Worklist (WL).
* **Allowed Next States**: `PEND`, `ROUTED`, `QC_WB` (if QC enabled), `RESOLVED` (if QC disabled), `FILED`.

### 3. `PEND`
* **Definition**: Paused on a user's WL. Requires a **compulsory comment** AND **compulsory Date/Time timestamp**.
* **Unpend Trigger**: Reopens automatically on the scheduled Date/Time OR when client uploads files/replies via email.
* **Allowed Next States**: `ASSIGNED` (returns directly to the assigned user's WL).

### 4. `ROUTED`
* **Definition**: Routed by an assigned user to a target department's WB.
* **Allowed Next States**: `ROUTED_ASSIGNED`.

### 5. Routed Sub-States (`ROUTED_ASSIGNED`, `ROUTED_PEND`, `ROUTED_SUBMITTED`)
* **`ROUTED_ASSIGNED`**: Target user pulls routed docket to their WL. (Allowed next: `ROUTED_PEND`, `ROUTED_SUBMITTED`).
* **`ROUTED_PEND`**: Target user pends for additional inputs with compulsory comment & timestamp. (Allowed next: `ROUTED_ASSIGNED`).
* **`ROUTED_SUBMITTED`**: Target user completes their routed work with compulsory comment and submits back to the originating user's WL as `ASSIGNED`.

### 6. `FILED`
* **Definition**: Docket opened in error or cancelled. Permanent terminal state.
* **Cloning Feature**: A new docket can be cloned from `FILED`, inheriting all historical attachments and comments.

### 7. `RESOLVED`
* **Definition**: Work is 100% complete and verified. Terminal success state.

### 8. `QC_WB` & 9. `QC_ASSIGNED`
* **`QC_WB`**: Resolved docket with QC enabled moves to QC Workbasket.
* **`QC_ASSIGNED`**: QC reviewer pulls docket to their WL.

### 10. QC Outcome States (`QC_PASS`, `QC_FAIL`, `QC_CORRECTED`)
* **`QC_PASS`**: Approved → Transitions to `RESOLVED` (No comment required).
* **`QC_FAIL`**: Rejected → Compulsory comment required → Routes back to original user's WL as `ASSIGNED`.
* **`QC_CORRECTED`**: Rejection reason fixed on spot by QC reviewer → Compulsory comment required → Transitions to `RESOLVED`.
