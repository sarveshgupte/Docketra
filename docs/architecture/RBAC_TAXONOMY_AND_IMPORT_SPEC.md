# Docketra Specification: Role-Based Access Control (RBAC), Taxonomy & Data Import Architecture

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-25  
**Status**: APPROVED & LOCKED  

---

## 1. Executive Summary

This document specifies the authoritative access control model, taxonomy hierarchy, team scoping, and bulk onboarding import architecture for the **Docketra B2B SaaS Platform**.

All implementation contracts documented herein have been verified against runtime models (`User.model.js`, `Case.model.js`, `Category.model.js`, `Team.model.js`), RBAC middleware (`rbac.middleware.js`, `permission.middleware.js`), and frontend views (`FirmSettingsPage.jsx`, `ClientsPage.jsx`, `CasesPage.jsx`).

---

## 2. User Roles & Hierarchy Architecture

Docketra employs a dual-layered authorization architecture:
1. **Platform Level**: Platform oversight (Cross-tenant, `firmId = null`).
2. **Firm Level**: Multi-tenant workspace RBAC (Rank 1 through 4).

```
                               ┌─────────────────────────┐
                               │       SUPER_ADMIN       │  (Platform Level - Cross Tenant)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │      PRIMARY_ADMIN      │  (Firm Level - Rank 4 - Workspace Owner)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │          ADMIN          │  (Firm Level - Rank 3 - Operations Admin)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │         MANAGER         │  (Firm Level - Rank 2 - Supervisor / Lead)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │          USER           │  (Firm Level - Rank 1 - Staff / Executive)
                               └─────────────────────────┘
```

### 2.1 Role Definitions

| Role Code | Rank | Multi-Tenant Scope | Key Responsibilities & Capabilities |
| :--- | :---: | :--- | :--- |
| `SUPER_ADMIN` | N/A | Platform-wide (`firmId = null`) | Cross-tenant platform administration, firm onboarding, global subscription plans, platform feature flags, AI assistant, and system-level diagnostics. *Blocked from firm-private operational dockets.* |
| `PRIMARY_ADMIN` | **4** | Firm Workspace (`firmId`) | **Firm Owner & Primary Administrator**. Full firm administration rights + **exclusive** control over BYOS Cloud Storage configuration and Bulk Data Import features (Client and Historical Docket imports). |
| `ADMIN` | **3** | Firm Workspace (`firmId`) | **Firm Administrator**. Full operational access across all clients, dockets, taxonomy, SLA rules, categories, subcategories, workbaskets, work types, user invitations, and workspace reports. |
| `MANAGER` | **2** | Assigned Team (`firmId` + `teamId`) | **Team / Operations Manager**. Queue supervisor overseeing team throughput, docket reassignments, workbasket review, Quality Control (QC) sampling, and team member management within assigned teams. |
| `USER` | **1** | Assigned Team (`firmId` + `teamId`) | **Staff / Execution Associate**. Operational execution role for Company Secretaries, CAs, and compliance associates executing dockets, logging effort hours, attaching files, and updating work states. |

---

## 3. Settings Permission Matrix

Access to administrative and workspace settings is strictly governed by role ranks and middleware policy guards (`requirePrimaryAdmin`, `authorizeFirmPermission`).

| Settings Area | UI Location | `PRIMARY_ADMIN` | `ADMIN` | `MANAGER` | `USER` | `SUPER_ADMIN` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Workspace Operational Defaults** *(SLA default days, lead time, escalation thresholds)* | `/settings` ➔ Defaults | ✅ Full | ✅ Full | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Work Calendar Settings** *(Working days, holidays, working-date overrides)* | `/settings` ➔ Calendar | ✅ Full | ✅ Full | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **SLA Override Rules** *(Custom SLA rules per category/subcategory/workbasket)* | `/settings` ➔ SLA Rules | ✅ Full | ✅ Full | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Bulk Data Import** *(Client bulk upload & Historical docket import)* | `/settings` ➔ Data Import | 👑 **Exclusive** | ❌ Disabled | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **BYOS Storage Setup** *(Google Drive / S3 / OneDrive credentials & bucket config)* | `/storage/settings` | 👑 **Exclusive** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **User Management** *(Invites, role changes, client access restrictions)* | `/admin` | ✅ Full | ✅ Full *(Excl. Primary)* | 🟡 View Team | ❌ Blocked | ❌ Blocked |
| **Taxonomy Master** *(Categories, Subcategories, Work Types, ID Prefixes)* | `/work-types` / `/admin` | ✅ Full | ✅ Full | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Workbaskets & Teams** *(Team creation, manager assignment, QC workbaskets)* | `/workbaskets` / `/admin` | ✅ Full | ✅ Full | 🟡 View Assigned | ❌ Blocked | ❌ Blocked |
| **AI Intelligence Settings** *(AI model selection, RAG library scope)* | `/settings/ai` | ✅ Full | ✅ Full | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Personal Profile & Security** *(Password change, preferences)* | `/profile` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **SaaS Platform Settings** *(Plans, tenant onboarding, global feature flags)* | `/superadmin/*` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | 👑 **Exclusive** |

---

## 4. Taxonomy & Automated Docket Routing Architecture

### 4.1 Relationship Schema

```
Firm Workspace (firmId)
  │
  ├── Workbaskets / Teams (Team.model.js)
  │     ├── ROC Filings Team (teamId: ObjectId)
  │     ├── GST Operations Team (teamId: ObjectId)
  │     └── Direct Tax Team (teamId: ObjectId)
  │
  └── Categories (Category.model.js)
        │
        ├── Category: "Secretarial & Corporate Law"
        │     │
        │     ├── Subcategory: "Annual Return (MGT-7)" ──────► Linked to workbasketId = "ROC Filings Team"
        │     └── Subcategory: "Director KYC (DIR-3)"  ──────► Linked to workbasketId = "ROC Filings Team"
        │
        └── Category: "Taxation & Filings"
              │
              ├── Subcategory: "GSTR-3B Filing"        ──────► Linked to workbasketId = "GST Operations Team"
              └── Subcategory: "ITR Scrutiny"          ──────► Linked to workbasketId = "Direct Tax Team"
```

### 4.2 Automated Routing Flow
1. **Subcategory Linkage**: Every nested `subcategory` in `Category.model.js` requires a `workbasketId` referencing `Team._id`.
2. **Docket Creation**: When a docket is created (via UI or bulk CSV import), selecting a **Category** and **Subcategory** automatically resolves `workbasketId` (`teamId`).
3. **Queue Landing**: The docket lands directly in the assigned team's active workbasket queue, notifying the Team Manager and team members.

---

## 5. Bulk Data Import Architecture

To onboard firms with existing multi-year historical data, Docketra supports two primary bulk import workflows, hosted under **Workspace Settings** (`/settings` ➔ **Data Import** tab) and gated strictly to **Primary Admins**.

```
Workspace Settings (/settings)
  │
  ├── 1. Client Bulk Import (type="clients")
  │     └── Upload CSV with Business Name, Email, Phone, PAN, GST, Address
  │
  └── 2. Historical Docket Bulk Import (type="dockets")
        ├── GET /api/dockets/bulk/template (Downloads live pre-filled CSV template with active clients)
        ├── POST /api/dockets/bulk/preview (Validates client IDs, status, dates, assignees)
        └── POST /api/dockets/bulk/upload  (Creates historical dockets with status='RESOLVED', custom dates)
```

### 5.1 Historical Docket Model Contract (`Case.model.js`)

Historical imported dockets record historical work completed prior to joining Docketra while maintaining system integrity:

- **`isHistoricalImport`**: Boolean (default `false`, indexed). Set to `true` for historical imports.
- **`importedAt`**: Date. Timestamp of import job execution.
- **`importJobId`**: String. Reference to `BulkUploadJob._id`.
- **Status & Date Override**:
  - `status: 'RESOLVED'` forces `state = 'RESOLVED'` and sets `resolvedAt = completedDate`.
  - `createdAt` is overridden to `startDate` so past work displays accurately in client historical timelines.

---

## 6. Verification & Release Gate Protocol

All RBAC, taxonomy, and import features must pass the following release gates prior to merge or production deployment:

1. **Route Contract Gate**: `npm run ci:backend:routes` (Verifies route schema coverage & mount order).
2. **Pure Release Gate**: `npm run ci:release-gate:pure` (Verifies zero failures across 100% backend & frontend test suites and production build).
3. **Deploy Safety Gate**: `npm run ci:backend:deploy-safety` (Validates production environment variable contracts).

---

**Lock Authorization**:  
*Engineered and verified by Antigravity AI Coding Assistant (Google DeepMind).*
