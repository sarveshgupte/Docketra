# Current Product Overview (April 2026)

## Product summary

Docketra is a firm operations platform for B2B service teams.

It unifies:
- **acquisition and intake** (CMS),
- **relationship and pipeline management** (CRM),
- **delivery execution** (Task Manager with dockets, allocation, QC, and reporting).

Docketra is designed for multi-user firm operations where auditability, secure role boundaries, and predictable workflows matter.

## Target users and operating roles

### Target organizations
- Small and mid-sized professional service firms.
- Teams moving from fragmented spreadsheets + chat + ad-hoc tools to structured operations.

### Operating roles
- **Primary Admin**: workspace owner-level controls, onboarding completion, firm-level configuration.
- **Admin**: configuration and management operations.
- **Manager**: allocation, supervision, queue oversight.
- **User**: execution of assigned/pulled work.

(Platform behavior and visibility are role-aware and firm-scoped.)

## Product modules

## 1) CMS (Intake / Capture)

Purpose: convert inbound demand into structured operational data.

Current capabilities:
- Docketra-hosted intake flows and request links.
- Embeddable website forms.
- API intake for external systems.
- Intake orchestration into lead/client/docket where configured.

## 2) CRM (Pipeline / Relationship)

Purpose: qualify and convert opportunities into active client work.

Current capabilities:
- Lead stages and lifecycle controls.
- Lead ownership and follow-up tracking.
- Notes and activity context.
- Client management as execution-ready account records.

## 3) Task Manager (Execution)

Purpose: run service delivery with queue clarity and quality controls.

Current capabilities:
- Docket lifecycle management.
- Workbasket, My Worklist, QC queue, and all-dockets oversight surfaces.
- Work allocation and reassignment patterns.
- Attachment handling on dockets.
- Activity/history visibility and auditable transitions.

## 4) Reports + operational controls

Purpose: measure throughput/health and manage workspace operations.

Current capabilities:
- Operational reports and role-aware visibility.
- Onboarding and setup guidance.
- Access/team controls and settings surfaces.
- Storage and security-oriented workspace settings.

## End-to-end operating model

Canonical flow:

`CMS intake -> CRM qualification/conversion -> Task Manager execution`

This allows firms to track work from inbound request to completed delivery while preserving identity context and audit trail.

## Technical posture (high level)

- React/Vite frontend (`ui/`)
- Node/Express backend (`src/`)
- MongoDB primary datastore
- Redis-backed background processing for queue/worker tasks
- Tenant-aware auth/authorization, security middleware, and diagnostics

## Data ownership and security posture

- **Firm-scoped tenancy**: records and runtime access are tenant-bounded.
- **Role hierarchy enforcement**: primary admin > admin > manager > user.
- **BYOS-first direction**: storage ownership remains firm-centric; optional providers are configurable.
- **Secure defaults**: rate limits, request IDs, validation, and audit logging are core behaviors.
- **Optional service resilience**: optional integrations (including AI providers) should not block core product operation when disabled.

## In-repo references

- Module model: `docs/product/MODULE_OPERATING_MODEL.md`
- Navigation and terminology: `docs/product/navigation-and-terminology-model.md`
- Pilot checklist: `docs/operations/pilot-readiness-checklist.md`
- Security model: `docs/security/SECURITY_MODEL.md`
