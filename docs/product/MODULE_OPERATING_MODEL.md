# Docketra Module Operating Model

Docketra is organized as three connected product modules.

## 1) CMS (Acquisition)
Use CMS to capture demand and intake:
- Docketra-hosted landing pages
- Embeddable forms for external firm websites
- Direct API/webhook intake path (integration mode)
- Submission intake queue and public intake tools

**Outcome:** creates structured leads and optional client/docket handoff.

## 2) CRM (Relationship Management)
Use CRM to manage pipeline and relationships:
- Leads
- Lead ownership + follow-up tracking
- Stage progression (`new -> contacted -> qualified -> converted|lost`)
- Relationship notes + activity timeline
- Clients / accounts
- Deals
- Invoices (when used as relationship records)

**Outcome:** qualifies and converts demand into execution-ready client context.

## 3) Tasks (Execution)
Use Tasks to run operations:
- Dockets
- Worklists
- QC queues
- Internal work
- Operational queues

**Outcome:** executes client and internal work with SLA/audit controls.

---

## Module handoff flow

`CMS -> CRM -> Tasks`

- CMS captures and normalizes intake.
- CMS supports multiple acquisition channels without changing downstream intake orchestration.
- CRM manages relationship state and client readiness.
- CRM now explicitly tracks conversion metadata and whether downstream work has started.
- Tasks executes delivery work while preserving CRM linkage and internal-work support.

This structure keeps route compatibility while improving user orientation in navigation, dashboards, and page-level context headers.

## Module landing hubs (April 2026 enhancement)

Docketra now includes dedicated overview hubs for each primary module route:

- `/crm` → CRM landing page
- `/cms` → CMS landing page
- `/task-manager` → Task Manager landing page

Each landing page is now the module “home” with:

- a plain-language summary of module purpose,
- key KPI cards,
- quick actions,
- direct links to sub-features,
- role-aware visibility for admin/manager-only controls.

Navigation behavior was also improved: parent module labels are now first-class destinations (not expand-only toggles), while a separate chevron target still handles expand/collapse for child links.


---

## Positioning summary for marketing

Docketra is positioned as a connected operating system for firms that need to:
- get clients (CMS),
- manage clients (CRM), and
- execute work (Tasks).

This message should stay simple and explicit on public pages to reduce ambiguity for first-time visitors.

## Current go-to-market status

- Early access is currently free.
- Billing and subscription setup are not live yet.
- Public contact: `sarveshgupte@gmail.com`

## Workspace productivity model (April 2026)

To support desktop-heavy daily operations, module navigation now follows a shared command-center model:

1. **One entry point for jump/search**
   - Top workspace command trigger opens a unified command palette.
   - Scope intentionally combines module destinations + high-frequency quick actions + record lookup.

2. **Keyboard-first but conservative**
   - Primary open command: `Cmd/Ctrl + K`
   - Quick open/focus: `/` (only outside editable inputs)
   - Route jump set: `Alt + Shift + N/D/T/W/B/Q`
   - No shortcut fires while typing in inputs, textareas, selects, or contenteditable controls.

3. **Naming consistency contract**
   - Creation actions use `New ...`.
   - Navigation actions use `Go to ...`.
   - Queue labels remain canonical (`Workbasket`, `My Worklist`, `QC Queue`, `Intake Queue`).

4. **Role-aware command inventory**
   - Admin-only module destinations remain hidden for non-admin roles.
   - Shared baseline commands remain available to all permitted firm users.

5. **Discoverability without clutter**
   - Helper hint copy lives inside command center instead of heavy onboarding overlays.
   - Account actions (including `Sign out`) remain available in both menu and command flow.

## Command-center reliability rules (April 2026 follow-up)

1. **Shortcut ownership**
   - Workspace-level shortcut listeners are owned by `PlatformShell` only.
   - Command palette component is render/interaction-only (filtering, option navigation, execution).

2. **Typing safety contract**
   - Global shortcuts must never fire from editable surfaces (`input`, `textarea`, `select`, `contenteditable`).

3. **Async search contract**
   - Record lookup runs only while the command center is open.
   - Stale async responses must be ignored via request sequencing checks.
   - Quick actions and module commands remain usable even when record lookup is degraded.

## CRM workspace contract (April 2026 unification)

CRM now follows one explicit route-level workspace contract across:

- `/crm` (module hub)
- `/crm/clients` (Client Management)
- `/crm/clients/:crmClientId` (Client Detail)
- `/crm/leads` (Leads queue)

### UI contract requirements

- Shared shell + section primitives only (`PlatformShell`, `PageSection`, `StatGrid`, `FilterBar`, platform `DataTable`, inline notices).
- Consistent quick-action language and ordering across CRM routes.
- Consistent empty/loading/error treatment and modal rhythm for CRM create/manage flows.
- No legacy `Layout` semantics, `neo-*` style classes, or route-local visual pattern forks on migrated CRM routes.

### Error handling contract

- CRM route failures must show CRM-specific recovery guidance.
- Tenant/firm-resolution copy (for example `Firm not found`) is only valid when firm context is truly invalid at the auth/tenant layer, not for routine CRM data-load failures.
