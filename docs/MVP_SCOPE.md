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

## Roadmap Note
- CMS and advanced CRM surfaces can be revisited after client-based docket/task workflows are stable in production.
