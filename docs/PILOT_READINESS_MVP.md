# Pilot Readiness MVP

## MVP navigation scope
PlatformShell now exposes only MVP modules:
- Daily Operations: Work, Dashboard
- Client Workspace: Clients
- Oversight: Reports
- Administration: Team & Access, Settings

Dormant modules (Knowledge Intake, Relationships, Company Brain, Knowledge Library and related command destinations/routes) are hidden from MVP navigation.

## Clients as a core dependency
Clients list and Create Docket depend on a safe minimal client payload:
- clientId
- businessName
- status
- isActive
- isDefaultClient
- isSystemClient
- isInternal
- createdAt

## Default firm/internal client behavior
Each firm is guaranteed to have an internal default/system client (idempotent self-heal path).
This client remains active and protected from deactivation, and is used for internal work.

## Create Docket behavior
Create Docket can proceed with only the default firm client present.
External clients are optional for pilot readiness.

## TENANT_KEY_MISSING handling
Client list paths avoid decrypting optional encrypted contact fields.
Repository decryption now requires tenant key only if selected fields actually contain encrypted values.
No ciphertext is surfaced as plaintext fallback.

## Repair/backfill process
Use a tenant-safe inspection flow before creating keys:
1. Check if tenant key exists.
2. Check whether encrypted client fields exist.
3. Create key only if no encrypted client field data exists.
4. If encrypted data exists and key is missing, do not auto-repair with a new key; escalate to manual recovery/reset.

## Safety guarantees
- No destructive migration included.
- Legacy backend modules/routes remain dormant (not removed).

## Routing defaults and explicit setup
For pilot readiness, firms must have minimal routing defaults: one active workbasket, one active category, and one active subcategory mapping.

- Default workbasket: `Default Workbasket`
- Default category: `General`
- Default subcategory: `General Work` (mapped to the default workbasket)

Defaults are seeded idempotently only through explicit setup paths (bootstrap-safe setup and the admin default-routing setup action) without overwriting custom routing.
Loading Work Settings or Create Docket never mutates routing configuration.

## First docket path
1. Login and land in MVP navigation only.
2. Use default firm/internal client for internal work.
3. Confirm routing setup is ready (default or custom).
4. Create first docket with default client + category/subcategory + active workbasket.
5. Docket appears in Work/workbasket queues.

Work Settings is routing-only for MVP and has no CMS/CRM/Company Brain dependency.

## Workbasket and Worklist operating model
- **Workbasket** = a shared team queue used for routing and pull-based execution.
- **My Worklist** = a single personal queue for one user.
- A user can be linked to multiple workbaskets (Admin/Manager/Employee supported).
- Users switch work context between linked workbaskets in Global Workbasket views.
- Users pull dockets from a linked workbasket into their own My Worklist.
- Default routing setup never removes, replaces, or collapses existing multi-workbasket memberships.

## Team & Access Pilot Readiness Guardrails (May 2026)

- Team & Access must always show the current logged-in Primary Admin, even if `/api/admin/users` fails or returns an empty set.
- User list rendering is independent from workbasket loading; workbasket load failures must not block the Team Members table.
- Workbasket assignment remains multi-select and multi-membership (`teamIds[]`), and save uses `/api/admin/users/:xID/workbaskets`.
- My Worklist remains a personal/single-user queue view; team assignment belongs to Team & Access.
- Team & Access is required for pilot setup readiness and cannot be blocked by optional dependency failures.
