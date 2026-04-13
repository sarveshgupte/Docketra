# Docketra Firm Hierarchy & Access Model

This document defines the **intended in-firm hierarchy**, reporting relationships, and security guardrails used by the backend.

---

## 1) Canonical role order (highest → lowest)

1. `PRIMARY_ADMIN`
2. `ADMIN`
3. `MANAGER`
4. `USER`

`SUPER_ADMIN` is platform-scoped and **not** part of any firm hierarchy chain.

---

## 2) Reporting/reference fields

Each non-platform user may contain hierarchy tags:

- `primaryAdminId` → must point to a `PRIMARY_ADMIN` in the same firm
- `adminId` → must point to an `ADMIN` in the same firm
- `managerId` (alias: `reportsToUserId`) → must point to a `MANAGER` in the same firm

### Role constraints

- `PRIMARY_ADMIN`:
  - `primaryAdminId = null`
  - `adminId = null`
  - `managerId = null`
- `ADMIN`:
  - `primaryAdminId` required
  - `adminId = null`
  - `managerId = null`
- `MANAGER`:
  - `primaryAdminId` required
  - `adminId` optional (if firm chain uses explicit admin link)
  - `managerId = null`
- `USER`:
  - `primaryAdminId` required
  - `adminId` optional
  - `managerId` optional

---

## 3) Security invariants (must always hold)

For every hierarchy reference (`primaryAdminId`, `adminId`, `managerId`):

- reference must exist
- referenced user must not be soft-deleted
- referenced user must be in the same `firmId`
- referenced user must have the expected role
- self-reference is not allowed

### Chain consistency

- If `adminId` is set, that admin must belong to the same `primaryAdminId`.
- If `managerId` is set, that manager must belong to the same `primaryAdminId`.
- If both `adminId` and `managerId` are set, manager must belong to that admin.

These rules prevent malformed hierarchy links and accidental cross-firm access/privilege bleed.

---

## 4) Invite/assignment expectations

Allowed invite flow (by role):

- `PRIMARY_ADMIN` can invite: `ADMIN`, `MANAGER`, `USER`
- `ADMIN` can invite: `MANAGER`, `USER`
- `MANAGER` can invite: `USER`
- `USER` cannot invite

Non-`PRIMARY_ADMIN` inviters cannot arbitrarily patch hierarchy tags during invite.

---

## 5) Operational note

When changing hierarchy logic, update **both**:

1. Runtime validation in code (model/controller/service as needed)
2. This document (`HIERARCHY.md`)

This keeps future maintenance and AI-assisted edits aligned with current security expectations.
