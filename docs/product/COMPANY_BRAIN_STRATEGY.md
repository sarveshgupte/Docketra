# Docketra Company Brain Strategy

## One-line product definition

Docketra is a Company Brain and work execution system for professional firms.

---

## Plain-English explanation

Docketra helps firms remember, organize, and execute work by connecting clients, tasks, documents, deadlines, team knowledge, internal processes, and decisions into one living workspace.

A professional firm accumulates enormous amounts of context over time: who the client is, what was promised, what work was done last year, which checklist applies, who reviewed it, and what instructions are specific to that client. Today that context lives in email threads, spreadsheets, sticky notes, and individual team members' heads. Docketra brings it all into one place where it stays current, stays connected, and stays executable.

---

## Why this pivot is needed

- **CRM, CMS, and Task Manager as separate modules can feel like disconnected tools.** A lead lives in CRM, a document lives in CMS, a task lives in Task Manager — but they all belong to the same client engagement.
- **Professional firms do not only need a CRM or task manager.** They need institutional memory: a record of what was done, how it was done, what the client prefers, and what comes next.
- **They need that memory to stay current, connected, and executable.** Knowledge that cannot be acted on has limited value. Knowledge that is disconnected from actual work is forgotten.
- **Docketra should not become a generic HubSpot / Notion / Trello clone.** It is purpose-built for professional firms with recurring client work, compliance deadlines, and multi-person execution workflows.

The pivot is not about discarding what exists. It is about giving existing modules a shared purpose: feeding institutional memory so that any person on the team — and eventually the firm itself — can answer "what do we know about this client, and what needs to happen next?"

---

## New product layers

### Work Layer
Tasks, dockets, worklists, deadlines, assignments, QC queues, internal work, and client-facing work. This is where things get done. Every piece of work is tracked, assigned, reviewed, and completed.

### Relationship Layer
Clients, prospective clients, contacts, notes, promises, follow-ups, and client history. This is where relationships are managed. Every interaction, conversion, and long-term context about a client lives here.

### Knowledge Layer
SOPs, checklists, templates, internal instructions, process notes, and client-specific instructions. This is the firm's playbook. Standard work is documented, reusable, and linked to the work that uses it.

### Brain Layer
The connected map across clients, work, documents, people, processes, notes, decisions, and deadlines. This is not a separate module. It is the connective tissue that makes the other three layers useful together. A docket links to the client. The client links to past work. Past work links to the checklist used. The checklist links to the SOP. The SOP links to the reviewer's notes. The Brain Layer is what emerges when these connections are maintained consistently.

---

## Mapping from old modules to new language

| Old module / concept | New language |
|---|---|
| CMS | Knowledge Intake |
| CRM Leads | Prospective Clients |
| CRM Clients | Client Memory / Relationships |
| Task Manager | Work Execution |
| Documents | Linked Context |
| Notes | Institutional Memory |
| Reports | Operational Insights |
| Company Brain | Connective layer across all of the above |

This mapping is a terminology layer, not a breaking change. Existing routes, models, and functionality are preserved. The new language describes what these modules contribute to the bigger picture.

---

## Practical examples

### Example 1: PCS firm — new prospective client inquiry

A prospective client calls asking for ROC compliance help for their private limited company.

1. **Capture the enquiry** — A lead is created in CRM (Prospective Clients). Basic details: name, contact, company name, type of work needed.
2. **Collect company details** — CIN, registered address, directors, and last filing status are added to the lead record.
3. **Create a follow-up task** — A task is assigned to the relationship manager: call back within 24 hours, send capability deck.
4. **Record notes** — Post-call notes are logged: client is price-sensitive, currently with a Big 4 firm, wants to move for responsiveness.
5. **Send a proposal** — A proposal document is attached to the lead record and sent. Follow-up task is updated.
6. **Convert to active client** — Lead is converted. Client record is created with full context carried forward: notes, documents, company details, and conversation history.
7. **Preserve all context** — The client record now contains the full intake history. Any team member picking up this client can see exactly what happened, what was promised, and what the client cares about.

This is Knowledge Intake (CMS) feeding Client Memory (CRM) feeding Work Execution (Tasks) — the Company Brain model in practice.

---

### Example 2: Existing client — annual compliance for a private limited company

An existing client is due for annual ROC compliance. The work involves filing AOC-4 and MGT-7.

1. **Linked tasks** — A docket is created for annual compliance. It contains child tasks: prepare financials, draft board resolution, file AOC-4, file MGT-7, send confirmation to client.
2. **Linked documents** — Previous year's filed documents are attached as reference context. Draft financials are uploaded as working documents.
3. **Checklist** — The standard annual compliance checklist is linked from the Knowledge Layer. It contains pre-filing steps, review gates, and post-filing confirmations.
4. **Client-specific instructions** — The client record contains a note: "Client prefers to review draft resolutions before filing. Always send for approval with 5 days' notice."
5. **Reviewer** — The docket is assigned a preparer and a QC reviewer. The QC gate must be cleared before filing tasks are unlocked.
6. **Previous-year reference** — Last year's docket is linked for comparison. The team can see what was different, what issues came up, and what the client approved.
7. **Completion history** — When the work is done, the docket is closed with a completion record. The client's history now shows this engagement, and next year's cycle can reference it.

This is the Company Brain in a steady-state: every piece of context — client preferences, standard process, prior work, documents, reviewers, and completion records — connected to the work being done.

---

## Non-goals for now

The following are explicitly out of scope for this strategy phase:

- No AI chatbot
- No document extraction or OCR
- No vector database
- No embeddings
- No graph database
- No deletion of existing CRM, CMS, or Task Manager functionality
- No route rewrites
- No new database models introduced by this strategy document

The Company Brain direction is a product framing and terminology layer first. The structured foundation must be reliable before intelligence layers are added on top.

---

## Future direction

The path to a full Company Brain follows a deliberate sequence:

1. **Structured records and connections** — Ensure clients, tasks, documents, and notes are reliably linked and consistently modelled. This is the foundation.
2. **Knowledge items and process templates** — Add SOPs, checklists, and templates as first-class records that can be linked to dockets and client work.
3. **Link knowledge to work** — When a docket is created for a known work type, the relevant checklist and instructions are surfaced automatically based on the connection between work type and knowledge record.
4. **Connected views** — Build views that show the full context of a client: their history, open work, relevant documents, and applicable SOPs — without navigating across separate modules.
5. **Ask Docketra (AI layer)** — Only after the structured foundation is reliable, add natural-language search and AI-assisted retrieval. The AI layer will be meaningful only when the underlying records are well-connected and trustworthy.

Jumping to step 5 before step 1 is complete produces an AI layer with nothing reliable to retrieve from. The sequence matters.

---

## KnowledgeItem foundation

`KnowledgeItem` is the first structured knowledge object in the Company Brain.

KnowledgeItems are firm-scoped records that store operational knowledge in structured form. They are the building blocks for the Knowledge Layer described above.

Supported types:
- **SOP** — Standard operating procedures
- **Checklist** — Step-by-step execution checklists
- **Template** — Reusable document or communication templates
- **Note** — Internal firm notes and institutional memory
- **Client instruction** — Client-specific instructions that apply across engagements
- **Process** — Informal process records and workflow notes

KnowledgeItems are intentionally minimal in this first implementation:
- They store structured text and metadata only (title, type, summary, content, tags, status, links).
- They are firm-scoped and admin-managed, with read access for all firm users.
- They support lifecycle states: `draft`, `active`, `archived`.
- They can be linked to a client, docket, or work type to support future connected-view queries.
- They do **not** store raw uploaded files. Heavy or sensitive documents remain in BYOS/storage and will be linked by pointer in future PRs.
- They do **not** introduce AI processing, vector embeddings, or document extraction.

This foundation enables the future Knowledge Library UI and linked-work flows described in the strategy sequence above.

Knowledge Library is the UI surface for managing KnowledgeItems. Firm admins can create, view, edit, filter, and archive KnowledgeItems from the Knowledge Library workspace under Firm Memory in the navigation.

---

## Connected map v1

Company Brain now displays a read-only connected view of Clients, Prospects, Work, and KnowledgeItems in one place.

The connected map is built by loading four existing data sources in parallel:
- `crmApi.listClients` → active client records
- `crmApi.listLeads` → prospective clients and enquiries
- `dashboardApi.getSummary` → active work, overdue work, and review queue
- `knowledgeItemsApi.listKnowledgeItems` → Knowledge Library records

These sources are combined into a single read-only view without a new backend aggregation endpoint. All connections are based on existing metadata fields on each record. No AI, graph DB, embeddings, or vector search is used.

The connected map shows five nodes, each with a count and a link to the relevant module:
- **Clients** → active client records (`/clients`)
- **Prospective Clients** → enquiries and conversion context (`/crm`)
- **Work** → dockets, deadlines, and review queues (`/task-manager`)
- **Knowledge Library** → SOPs, checklists, templates, notes, client instructions, and process records (`/knowledge`)
- **Company Brain** → this read-only connected command center (no link — current page)

Partial failure is handled gracefully: if knowledgeItems fails to load, clients, leads, and work data are still shown. A warning banner indicates partial data availability.

Knowledge health cues are derived from rule-based checks on loaded KnowledgeItems:
- Draft records that are not yet active
- Archived records that may need restoration
- Records with a `reviewDueAt` date on or before today
- Records with no assigned owner
- Records without a linked work type, client, or docket (described as "Knowledge without links")

This is still metadata/rule-based, not AI or graph infrastructure. The connected map v1 is a foundation for richer linked views in future versions.

---

## Linked Knowledge to Work

KnowledgeItems can now surface inside work/docket context through the **Linked Knowledge** tab on every docket detail page.

When viewing a docket, the Linked Knowledge tab fetches and displays relevant KnowledgeItems using three safe matching strategies:

1. **Linked to this docket** — KnowledgeItems where `linkedDocketId` equals the current docket ID.
2. **Matched by work type** — Active KnowledgeItems where `linkedWorkType` matches the docket's category/work type.
3. **Linked to client** — Active KnowledgeItems where `linkedClientId` matches the docket's client.

This is the first execution-time surface for the Knowledge Layer. No AI, vector search, embeddings, or document extraction is used. Linking is purely through existing metadata fields on KnowledgeItem records.

Firm admins can link SOPs, checklists, templates, notes, client instructions, and process records to dockets and work types directly from Knowledge Library.

---

## KnowledgeItem detail view

Users can now inspect any specific KnowledgeItem from two surfaces:

1. **Knowledge Library table** — Every row now has a View action that opens a read-only detail drawer/panel for that item without leaving the list.
2. **Linked Knowledge on docket detail** — "View in Knowledge Library" rows now deep-link directly to the exact KnowledgeItem using a `?item=<id>` query parameter on the Knowledge Library route (`/app/firm/:firmSlug/knowledge?item=<knowledgeItemId>`).

The detail drawer surfaces all structured metadata fields — title, type, status, summary, content, tags, owner, linked work type, linked client/docket, review due, last reviewed, and audit timestamps — in a read-only format. Users can launch Edit or Archive from the drawer without inline editing inside it.

This approach uses query param navigation so no new route is required and the Knowledge Library list remains visible and active behind the drawer. Closing the drawer removes the query param and restores normal list state.

Loading and error states are handled gracefully: if the item cannot be retrieved (archived, removed, or inaccessible), a clear message is shown and the main list continues to render. Admin-only write controls, BYOS/privacy boundaries, and no-AI/no-document-extraction behavior are all preserved.

---

## Client Knowledge in Client Memory

Client-linked KnowledgeItems now surface inside the client workspace so every team member can see client-specific instructions, SOPs, templates, notes, and process records when viewing a client.

A **Client Knowledge** section is added to the `ClientWorkspacePage` overview tab (the primary Client Memory surface reached from the main Clients navigation). When a client record has a stable internal Mongo ID (`client._id`), the section fetches active KnowledgeItems linked to that client via `listKnowledgeItems({ clientId: clientMongoId, status: 'active', limit: 50 })`.

Each knowledge row shows: title, type, status, tags, owner, review due date, summary, and a "Linked to client" source label. Every row has a "View in Knowledge Library" action that deep-links to the exact item using the existing `?item=<id>` query param.

Safe behaviours:
- If `clientMongoId` is unavailable, a clear safe empty state is shown instead of an error.
- If no linked knowledge exists, a descriptive empty state guides the user to add knowledge from Knowledge Library.
- Non-admin viewers see an additional note to ask an admin.
- No inline editing of KnowledgeItems is possible from client detail.
- The CRM-specific `CrmClientDetailPage` is preserved separately and carries a compatibility comment noting that `ClientWorkspacePage` is the primary Client Memory surface.

This is a read-only client-context surface backed by existing metadata links. No AI, vector search, embeddings, document extraction, new backend models, or new routes are used.
