# PRD: Docketra (MVP Baseline)

## Product summary
Docketra is a firm-scoped B2B SaaS web application for Indian professional firms and SMB companies. It integrates intake/CMS, CRM, and docket execution (task manager) so teams can move from inquiry to delivery inside one governed workspace.

This document is intentionally **MVP-reality aligned** with the current repository state and distinguishes implemented behavior vs. planned roadmap.

## Target users
### Primary organization types
- Company Secretary (CS) firms.
- Chartered Accountant (CA) firms.
- Legal and compliance operations firms.
- Boutique consulting and advisory firms.
- Small/mid-size Indian companies that run recurring compliance/operations dockets.

### Primary personas
- Firm primary admin (owner-level control).
- Firm admins/managers (pipeline + operations governance).
- Team members (docket execution).
- Superadmin (platform operations and multi-firm support).

## Primary use cases
1. Capture inbound requests via CMS forms, links, embeds, or API intake.
2. Qualify and convert leads in CRM.
3. Create/route dockets and execute from worklist/workbaskets/QC queues.
4. Maintain firm memory (clients, docs, knowledge context, audit history).
5. Configure firm-level settings, storage, and access controls.

## Core value proposition
- One firm workspace for **acquisition → relationship → execution**.
- Tenant-safe and role-aware controls for regulated/professional workflows.
- BYOS-first posture for data ownership, with safe managed-storage fallback.
- Operational reliability (audit trail, diagnostics, hardened auth/session flows).

## Product principles
1. **Tenant-first architecture**: no cross-firm data leakage.
2. **Workflow continuity**: CRM, CMS, and docket surfaces must connect natively.
3. **Production reliability over feature volume**: no broken nav, no dead-end placeholders in production surfaces.
4. **Secure by default**: enforce authn/authz, redaction, rate limiting, and auditable actions.
5. **BYOS/BYOAI optionality**: optional integrations must fail safe; core product must remain functional when disabled.

## MVP scope (current baseline)
- Firm-scoped auth/session infrastructure with firm-slug routing and superadmin surface.
- CRM leads + CRM clients flows.
- CMS intake modes and firm-level form workflows.
- Docket lifecycle + worklist/workbaskets/QC queue + attachments.
- Admin/user management and role-aware navigation.
- Storage settings with BYOS direction and managed storage fallback.
- Reporting and diagnostics surfaces suitable for pilot operations.

## Out-of-scope for MVP
- Deep AI-runtime orchestration beyond configuration contracts.
- Full enterprise BI suite and custom report builder.
- Complex multi-region data residency controls.
- Vertical-specific packaged compliance content libraries at scale.

## Core modules
- Auth and session management.
- Workspace/firm routing and tenant context enforcement.
- CRM module (leads, CRM clients, conversion surfaces).
- CMS module (forms, request links, embed/API intake patterns).
- Docket/task module (task manager + lifecycle + queues).
- Storage module (BYOS + default managed storage path).
- Superadmin and platform diagnostics.
- Reports and operational observability.

## Key workflows
1. **Onboarding**: create/activate firm → create admin identities → configure baseline settings.
2. **Storage decision**: encourage BYOS in onboarding/tutorial; fallback to Docketra-managed storage if skipped.
3. **Intake chain**: CMS submission → CRM lead → optional client → optional docket.
4. **Execution chain**: docket creation → assignment/routing → status transitions → QC/review → completion.
5. **Ops governance**: reports + audit logs + diagnostics for support and reliability.

## Data/privacy/security principles
- Tenant and firm slug must be first-class identity dimensions across API + UI routing.
- All business records are firm-scoped and must not be readable outside tenant context.
- Role hierarchy enforced in backend and UI (primary admin > admin > manager > user).
- Sensitive logs require redaction; diagnostics must avoid secret/data leaks.
- Optional AI/storage integrations should use explicit config and ownership validation.

## Success metrics
- Zero confirmed cross-tenant data access incidents.
- Auth/session critical flow pass rate (login/logout/password reset/OTP) ≥ agreed SLO.
- CMS→CRM→Docket conversion workflow reliability in pilot firms.
- Reduction in broken-route incidents and production navigation errors.
- Pilot firm retention/engagement on worklist and docket lifecycle completion.

## Risks and open questions
- AI provider runtime is partially stubbed and requires full implementation for production-grade BYOAI runtime.
- Browser-route inventory automation has environment limitations and should be stabilized for CI visibility.
- Some route aliases/legacy naming may continue to create “case vs docket” semantic drift.
- Need explicit beta gate definitions for operational support coverage and incident response SLAs.

## Assumptions
- “MVP” means pilot-ready with real firms under controlled onboarding, not broad public self-serve launch.
- BYOS remains strategic default, but managed storage remains required to reduce onboarding drop-off.
- Existing architecture and security docs remain canonical implementation references.

## Related docs
- `docs/product/current-product-overview.md`
- `docs/product/MODULE_OPERATING_MODEL.md`
- `docs/product/storage-and-data-ownership.md`
- `docs/security/SECURITY_MODEL.md`
- `docs/operations/pilot-readiness-checklist.md`
