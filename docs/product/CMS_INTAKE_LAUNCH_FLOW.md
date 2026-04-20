# CMS Intake Launch Flow (Operational Scope)

_Last updated: April 20, 2026_

This document defines the **launch-testable CMS intake flow** for Docketra.

## Scope

This is intentionally an intake/acquisition module, not a full website builder.

Included:
- Form management for intake forms (create/edit/activate/embed settings).
- Public and embedded form intake submissions.
- Unified handoff into CRM and optional downstream Dockets.
- Truthful CMS queue visibility on outcomes.

Not included (intentional):
- Multi-page website CMS tooling.
- Rich form builder features (conditional logic, drag-drop sections, custom widgets).
- Marketing campaign management.

## Final CMS intake flow

`CMS Form Surface -> Unified Intake Orchestrator -> Lead -> optional Client -> optional Docket`

1. A form is configured under CMS form management.
2. Form is shared as:
   - Public link: `/forms/:id`
   - Embed link: `/forms/:id?embed=true`
3. Submission enters `processCmsSubmission` with submission metadata.
4. Lead is always created first.
5. Client/docket creation follows firm intake config (`firm.intakeConfig.cms`) unless overridden by another trusted controller flow.
6. Outcome metadata is persisted on the lead for CMS/CRM queue visibility.

## Form management behavior

CMS form management now supports:
- create form
- edit form name
- edit fields (key, label, type, required)
- toggle `isActive`
- toggle `allowEmbed`
- manage `allowedEmbedDomains`
- edit success message and redirect URL
- copy public link, embed link, and iframe snippet

Guardrails:
- Public/embed-compatible forms require a `name` field.
- Embed submissions enforce `allowEmbed` and optional domain allowlist.
- Honeypot field (`website`) and name spam pattern checks remain active.

## Submission outcomes persisted on leads

Lead metadata now stores an `intakeOutcome` object:

- `createdClient` (boolean)
- `createdDocket` (boolean)
- `clientId` (canonical client id when created)
- `docketId` (docket/case id when created)
- `source`
- `submissionMode`
- `formId`
- `formSlug`
- `autoCreateClientEnabled`
- `autoCreateDocketEnabled`
- `warnings[]` (routing/config warnings)
- `updatedAt`

This enables truthful queue states:
- lead only
- lead + client
- lead + client + docket
- warnings present

## CMS queue behavior

CMS queue now reads real lead fields and metadata (`metadata.intakeOutcome`) instead of phantom `lead.docketId` assumptions.

Visible queue dimensions:
- lead identity
- source
- submission mode
- created client?
- created docket?
- status/stage
- created at
- warning summary (when present)

Filters/search include:
- source
- submission mode
- outcome bucket
- free-text search

