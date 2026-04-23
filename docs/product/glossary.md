# Docketra Product Glossary (Canonical)

## Copy rule
- In all user-facing UI copy, prefer **“Docket”** over **“Case.”**

## Approved terms (use these)
- **Docket**: Core work record tracked through intake, execution, QC, and closure.
- **All Dockets**: Full oversight view across docket states, owners, and queues.
- **Docket Workbench**: Primary operational hub for routing users into execution queues.
- **Workbench**: Shared team queue of unclaimed dockets available to pull.
- **My Worklist**: Personal queue of dockets assigned to the signed-in user.
- **QC Workbench**: Quality-control queue for pass, correction, or fail decisions.
- **Filed**: Finalized docket outcome recorded as filed.
- **Resolved**: Finalized docket outcome completed without filing.
- **CRM**: Relationship workspace for leads, clients, deals, and invoices.
- **CMS**: Intake/submission workspace for forms, request links, and inbound processing.
- **Intake Queue**: Operational list of inbound CMS submissions and handoff outcomes (lead/client/docket).
- **SuperAdmin**: Platform-level role with cross-firm administration.
- **Primary Admin**: Highest firm-level administrator for governance and setup ownership.
- **Admin**: Firm-level administrator who manages day-to-day user access and setup tasks.
- **Manager**: Team lead role with operational oversight and limited admin scope.
- **Employee**: Standard firm user role for assigned docket execution.
- **Partner**: Optional firm collaboration role used when enabled by firm policy.
- **Role hierarchy (firm context)**: Primary Admin > Admin > Manager > Employee.
- **Platform boundary**: SuperAdmin is platform-only and should not appear as a firm team-management role.
- **Canonical firm role labels (admin-facing copy)**: Primary Admin, Admin, Manager, Employee, Partner.
- **Role storage compatibility note**: Backend may continue storing employee-tier users as `USER`; UI/admin copy must render that as `Employee`.

## Deprecated terms to avoid in UI
- **Case / Cases / All Cases** → use **Docket / Dockets / All Dockets**
- **Task Manager** (as destination label) → use **Docket Workbench**
- **Workbasket** (shared queue label) → use **Workbench**
- **QC Workbasket** → use **QC Workbench**
- **CRM client** (generic label) → use **Client** (within CRM context)
