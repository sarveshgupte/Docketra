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
