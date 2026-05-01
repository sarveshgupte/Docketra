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
