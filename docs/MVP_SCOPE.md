# Docketra MVP Scope (Task Manager / Work Manager)

## Included in MVP
- **Clients (core dependency):** client list, create, edit, activate/deactivate, and client selection during docket/work creation.
- **Dockets/Work/Tasks:** create and route dockets under clients, assign users, and manage execution through worklists.
- **Work Settings (routing-only):** workbasket management and category/subcategory access for docket routing.
- **Dashboard + Worklists:** operational visibility and queue-based execution.

## Intentionally Hidden/Dormant in MVP UI
- CMS Intake surfaces.
- Intake API key and CMS intake settings UI.
- Auto-create client/docket from CMS controls.
- Company Brain.
- Knowledge Library and Knowledge Intake entry points.
- Relationships / relationship graph and advanced CRM module navigation.

## Backend Retention Policy
- Backend models and routes for CMS/advanced CRM are retained and left dormant for future reactivation.
- No destructive migrations or collection deletions are included in MVP scope hardening.

## Why Clients Stay in MVP
- Dockets are created under clients, so client CRUD and client selection remain mandatory MVP capabilities.
- Tenant isolation, firm permissions, and encrypted client handling remain unchanged.

## Clients MVP Behavior Contract
- **Core dependency:** Clients are required before creating client-based dockets.
- **Minimum client fields:** business/client name is required; email and phone are optional when available.
- **Admin actions:** PRIMARY_ADMIN/admin can list, create, edit basic details, and activate/deactivate clients.
- **Activation rules:** deactivation is a reversible status change only; clients are never hard-deleted in MVP.
- **Docket behavior:** deactivated clients are excluded from active Create Docket client choices, while existing dockets under those clients remain viewable.
- **Operational error handling:** when client loading fails with `TENANT_KEY_MISSING`, UI must show “Client encryption setup needs repair before clients can be loaded.” and block dependent create/edit actions until repaired.
- **Client Fact Sheet (CFS):** admins can edit CFS from Clients page (`Edit CFS`), and docket detail provides view access from the info (`i`) button in the docket header area.
- **Docket execution context only:** CFS supports docket execution context (client profile notes/files for active work) and is not a CMS/CRM/Company Brain substitute.

## Create Docket Setup Prerequisites (MVP)
- **Clients are required:** Create Docket requires at least one active client before submit can proceed.
- **Category + subcategory are required:** Routing depends on active category/subcategory definitions.
- **Active workbasket is required:** Docket submit is blocked until at least one active workbasket is available for routing.
- **Users/team members:** Assignee is optional for queue-first routing, but admin setup guidance prompts team activation when assignment is required operationally.
- **Setup guidance UX:** Create Docket loads clients, categories, workbaskets, and users independently and shows a setup checklist with direct links to fix missing prerequisites.
- **Operational note (TENANT_KEY_MISSING):** if client loading fails because tenant encryption setup is missing, UI shows a setup-repair message and blocks docket submit until repaired.

## Roadmap Note
- CMS and advanced CRM surfaces can be revisited after client-based docket/task workflows are stable in production.

## Public Landing Positioning Note (May 2026)
- Public marketing/landing copy now reflects MVP scope as **client-based task and docket management**.
- Public claims for CMS, CRM, Company Brain, Knowledge Library, and related dormant modules remain intentionally excluded until reactivation.
