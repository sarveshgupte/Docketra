# Docketra User Roles & Authorization Reference

This document serves as the authoritative specification for all user roles, permissions, hierarchy constraints, and security guardrails across Docketra.

---

## 1. Overview & Scope Hierarchy

Docketra enforces a strict two-tier role architecture:
1. **Platform Level (Cross-Tenant):** Oversees platform health, tenant provisioning, and global diagnostics.
2. **Firm Level (Tenant-Scoped):** Manages a specific practice firm's clients, dockets, filings, workbaskets, and storage.

```
PLATFORM SCOPE
└── SUPER_ADMIN (Docketra Platform Operators)

FIRM WORKSPACE SCOPE (Rank 4 → 1)
└── PRIMARY_ADMIN (Managing Partner / Firm Owner — Rank 4)
    └── ADMIN (Partners & Practice Heads — Rank 3)
        └── MANAGER (Senior Associates & Team Leads — Rank 2)
            └── USER / EMPLOYEE (Associates, Trainees & Staff — Rank 1)
```

---

## 2. The 5 User Roles

### Platform Role

#### 1. Super Admin (`SUPER_ADMIN`)
* **Scope:** Platform-wide. No firm context (`firmId: null`).
* **Namespace:** Dedicated `/superadmin` routes and layout.
* **Capabilities:** 
  * Tenant firm provisioning, suspension, and domain configuration.
  * System diagnostics, global audit logs, and onboarding insights.
  * Platform-level maintenance and worker status.
* **Boundary Guardrail:** By design, Super Admins have zero access to firm-scoped confidential legal/financial business data (client files, dockets, emails, CRM records).

---

### Firm Roles

#### 2. Primary Admin (`PRIMARY_ADMIN`) — Rank 4
* **Identity:** The founder or managing partner who created the firm workspace.
* **Exclusivity:** Exactly **one** active `PRIMARY_ADMIN` exists per firm (enforced by a database partial unique index on `{ firmId: 1, role: 1 }`).
* **Exclusive Capabilities:**
  * **BYOS Storage Authority:** Only the Primary Admin can link, authenticate, test, or disconnect firm-owned Google Drive storage.
  * **Ownership & Billing:** Only the Primary Admin can complete firm setup, upgrade plans, or manage subscription contracts.
  * **Role Allocation:** Only the Primary Admin can promote or modify roles via `PATCH /api/users/:id/role`.
  * **Team Invitation:** Can invite `ADMIN`, `MANAGER`, and `USER` members.
* **Immutability Protection:** The Primary Admin account cannot be deactivated, deleted, or demoted through normal admin APIs.

#### 3. Admin (`ADMIN`) — Rank 3
* **Identity:** Partners, directors, or senior administrative heads.
* **Capabilities:**
  * Full access to client records, matters, dockets, and category settings.
  * Full oversight of operational reports, firm audit logs, and performance dashboards.
  * Can invite new `MANAGER` and `USER` team members.
* **Restrictions:**
  * Cannot disconnect or alter firm-owned Google Drive storage credentials.
  * Cannot modify user roles (cannot promote users to Admin or demote others).
  * Cannot deactivate or delete the Primary Admin.
  * Cannot invite other `ADMIN` users (only Primary Admin can appoint Admins).

#### 4. Manager (`MANAGER`) — Rank 2
* **Identity:** Senior associates, team leads, or queue supervisors.
* **Capabilities:**
  * Full visibility over assigned team workbaskets and execution queues.
  * Reassign dockets between team members and workbaskets.
  * Quality Control (QC) review and sign-offs for statutory filings.
  * Can invite `USER` team members into their team.
* **Restrictions:**
  * Cannot access billing, subscription, or firm storage settings.
  * Cannot modify practice categories or firm-level integrations.
  * Scoped reports and client access based on team boundaries.

#### 5. Employee / Staff (`USER` / alias `EMPLOYEE`) — Rank 1
* **Identity:** Associates, article clerks, trainees, and operational staff.
* **Capabilities:**
  * Execute daily statutory filings, document uploads, and checklist tasks.
  * Work on dockets assigned directly to them or pulled from permitted workbaskets.
  * Add internal work notes and attachments to active matters.
* **Restrictions:**
  * Restricted to assigned client categories and permitted workbaskets.
  * No access to firm settings, team management, or billing.
  * Subject to **Trainee Laptop Shield** (blocks local raw file downloads to unmanaged devices when active).

---

## 3. Delegation & Invitation Matrix

To prevent privilege escalation, user invitation and role assignment follow strict monotonic hierarchy rules:

| Actor Role | Permitted Invitee Roles | Can Promote / Demote Roles? | Can Deactivate / Delete? |
| :--- | :--- | :---: | :---: |
| **PRIMARY_ADMIN** | `ADMIN`, `MANAGER`, `USER` | **Yes** (via `PATCH /api/users/:id/role`) | Yes (all non-Primary Admin users) |
| **ADMIN** | `MANAGER`, `USER` | No | No (escalates to Primary Admin) |
| **MANAGER** | `USER` | No | No |
| **USER** | *None* | No | No |

---

## 4. Capability & Permissions Matrix

Legend: `F` Full access, `L` Limited / Scoped access, `N` No access.

| Capability / Surface | SUPER_ADMIN | PRIMARY_ADMIN | ADMIN | MANAGER | USER |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Platform Management (`/superadmin`)** | **F** | N | N | N | N |
| **My Worklist & Tasks (`/worklist`, `/tasks`)** | N | **F** | **F** | **F** | **F** (Assigned) |
| **Workbaskets & Queue Allocation** | N | **F** | **F** | **F** (Team) | **L** (Pull-only) |
| **QC Review & Sign-Offs (`/qc-queue`)** | N | **F** | **F** | **F** | **L** (If QC assigned) |
| **Client Workspace (`/clients`)** | N | **F** | **F** | **L** (Team clients) | **L** (Assigned) |
| **Compliance Deadlines Radar (`/calendar`)** | N | **F** | **F** | **F** | **F** (Assigned) |
| **Operational Reports & Audit Logs** | **F** (Cross-firm) | **F** | **F** | **L** (Team metrics) | **L** (Personal) |
| **Firm Settings & Categories** | N | **F** | **F** | N | N |
| **BYOS Google Drive Storage Settings** | **L** (Diagnostics) | **F** (Exclusive) | **L** (Read-only) | N | N |
| **Firm Billing & Plan Upgrades** | **F** (Platform) | **F** (Exclusive) | N | N | N |
| **User Role Mutation (`PATCH /:id/role`)** | N | **F** (Exclusive) | N | N | N |

---

## 5. Security & Architectural Guardrails

### 1. Database-Level Unique Primary Admin Constraint
In `src/models/User.model.js`:
```javascript
userSchema.index(
  { firmId: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: 'PRIMARY_ADMIN', status: { $ne: 'deleted' } },
    name: 'firm_primary_admin_role_unique'
  }
);
```
Guarantees that race conditions or faulty scripts cannot create duplicate Primary Admins within a firm.

### 2. Canonical Normalization at API Boundaries
Input roles are mapped to canonical uppercase tokens via `src/utils/role.utils.js` (backend) and `ui/src/utils/roleHierarchy.js` (frontend):
* `'Employee'`, `'Staff'`, `'user'` $\to$ `'USER'`
* `'Admin'`, `'admin'` $\to$ `'ADMIN'`
* `'PrimaryAdmin'`, `'primary_admin'` $\to$ `'PRIMARY_ADMIN'`
* `'SuperAdmin'`, `'superadmin'` $\to$ `'SUPER_ADMIN'`

### 3. Tenant Isolation Subordination
All role permissions are strictly firm-scoped. An `ADMIN` or `PRIMARY_ADMIN` in Firm A has zero rights or data visibility in Firm B. Every query automatically binds to `req.user.firmId`.
