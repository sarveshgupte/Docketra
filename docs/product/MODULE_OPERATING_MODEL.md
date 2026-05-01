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

---

## Company Brain direction

The CMS → CRM → Tasks handoff flow above remains the route-compatible operating model. Existing routes, navigation, and module boundaries are preserved.

Docketra's long-term product direction is to make these three modules feed a **Company Brain**: a connected, living map of how a firm works, who its clients are, and what has been done.

In this direction, each module plays a named role in a larger system:

- **CMS → Knowledge Intake** — Captures demand, enquiries, and incoming context. Every intake event adds to what the firm knows about the outside world.
- **CRM → Relationships / Client Memory** — Maintains the ongoing record of clients, prospective clients, interactions, promises, and history. This is institutional memory for the firm's relationships.
- **Tasks → Work Execution** — Executes delivery work. Every docket, worklist, and QC record adds to the firm's history of what was done, how, and by whom.
- **Company Brain → Connective layer** — The connections between clients, work, documents, knowledge, and decisions that make the firm's context navigable and usable over time. This is not a separate module; it emerges from well-maintained links across the modules above.

This is a product direction and terminology layer first, not a breaking architecture rewrite. No routes are changed. No models are deleted. No existing functionality is removed.

Future PRs may add knowledge records (SOPs, templates, checklists), process templates linked to work types, and connected views that surface full client and work context across modules. See `docs/product/COMPANY_BRAIN_STRATEGY.md` for the full strategy document.

`KnowledgeItem` is the first structured knowledge object feeding this direction. It provides a firm-scoped backend foundation for SOPs, checklists, templates, notes, client instructions, and process records. A full Knowledge Library UI and linked-work flows will be layered on top in subsequent PRs.

**Knowledge Intake vs Knowledge Library** — these are distinct surfaces with different purposes:
- **Knowledge Intake** (`/cms`) = incoming enquiries, form submissions, and external context captured from prospective clients and the outside world.
- **Knowledge Library** (`/knowledge`) = reusable internal firm knowledge such as SOPs, checklists, templates, notes, client instructions, and process records. These are structured operational records created and managed by firm admins.

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

---

## Knowledge Library and Work Execution surface

**Knowledge Library** (`/knowledge`) stores reusable firm knowledge managed by admins:
- SOPs, checklists, templates, notes, client instructions, and process records.
- Each KnowledgeItem can be linked to a work type, client, or specific docket via existing metadata fields.

**Work Execution** can surface relevant knowledge during docket execution:
- The **Linked Knowledge** tab on every docket detail page shows KnowledgeItems matched by docket ID, work type, or client.
- This is the first step toward executable memory — surfacing the right checklist, SOP, or client instruction at the moment work is being done.
- No AI, vector search, or document extraction is used. Linking is through existing KnowledgeItem metadata only.

This connection — Knowledge Library as the source of firm knowledge, Work Execution as the point of use — is the first concrete implementation of the Company Brain's Knowledge Layer feeding the Work Layer.

---

## Company Brain as read-only command center

**Company Brain** (`/company-brain`) is the read-only connected view across all modules:
- It loads clients, prospects, work, and KnowledgeItems together in one view without a new backend endpoint.
- It derives rule-based cues (knowledge health, attention signals, useful connections) from existing metadata fields.
- It does not edit, create, or delete any data.
- It links out to Clients, Relationships, Work, Knowledge Library, and Reports for action.
- No AI, vector search, embeddings, or graph DB is used. All connections are based on metadata links.

**Knowledge Library** (`/knowledge`) feeds reusable internal knowledge to Company Brain and to work execution:
- SOPs, checklists, templates, notes, client instructions, and process records created by firm admins.
- Each record can be linked to a work type, client, or specific docket via existing metadata fields.
- Knowledge Library records appear in Company Brain's connected map and knowledge health cues.
- Knowledge Library records surface during work execution via the Linked Knowledge tab on each docket.

**Knowledge Intake** (`/cms`) and **Knowledge Library** (`/knowledge`) are distinct:
- Knowledge Intake = incoming enquiries, form submissions, and external context from prospective clients.
- Knowledge Library = reusable internal firm knowledge managed by firm admins.

**Linked Knowledge** surfaces relevant Knowledge Library records during work execution:
- The Linked Knowledge tab on every docket detail page shows records matched by docket ID, work type, or client.
- Linking is through existing KnowledgeItem metadata only — no AI or document extraction.
