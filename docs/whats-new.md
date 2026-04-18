# What's New

## April 2026: API / Webhook Intake Mode for CMS

- Added direct integration endpoint for CMS intake: `POST /public/cms/:firmSlug/intake` (also available under `/api/public/...`).
- Added conservative integration auth using firm-level `intakeConfig.cms.intakeApiEnabled` + `intakeConfig.cms.intakeApiKey`, verified through `x-docketra-intake-key`.
- Direct API intake now routes through the existing unified intake orchestration service (no business-flow fork): `Submission -> Lead -> optional Client -> optional Docket`.
- API-origin submissions are now tagged with `submissionMode=api_intake` and default `source=api_integration` when source is not explicitly supplied.
- Added practical idempotency support for retries using `idempotencyKey`/`externalSubmissionId` (and optional `idempotency-key` header fallback) to prevent duplicate lead creation.
- Added stable API integration response contract with `success`, `leadId`, `clientId`, `docketId`, `warnings`, and `idempotentReplay`.
- Added `docs/product/CMS_API_INTAKE.md` with endpoint/auth/payload/response/failure examples and downstream mapping details.

## April 2026: Fix Lead Metadata Persistence + Dynamic Public/Embed Form Rendering

- Lead metadata schema now explicitly includes all intake attribution fields used by CMS/public/embed intake (`utm_source`, `utm_campaign`, `utm_medium`, `referrer`, `pageUrl`, `pageSlug`, `formSlug`, `formId`, `service`, `message`, `ipAddress`, `userAgent`, `submissionMode`).
- Public/embed submit validation now accepts dynamic configured field payloads while preserving anti-pollution sanitization and compatibility with existing intake keys.
- Public form rendering now uses stored `form.fields` as the source of truth (with safe defaults when no explicit config exists), instead of relying on a fixed hardcoded field layout.
- Public/embed submit payload construction is now field-driven and still appends intake attribution metadata (`pageUrl`, `referrer`, UTM params, `submissionMode`) plus honeypot signal.
- Added conservative misconfiguration guardrails so public/embed forms require a `name` field; forms without `name` are safely rejected for public submission.
- CMS module embed tooling now shows which configured fields are rendered publicly to reduce admin/operator confusion.

## April 2026: CRM Pipeline + Lead Ownership + Follow-up System

- Lead records now support a conservative CRM lifecycle with stage/status compatibility (`new`, `contacted`, `qualified`, `converted`, `lost`).
- CRM leads now support ownership (`ownerXid`), follow-up tracking (`nextFollowUpAt`, `lastContactAt`), conversion metadata (`convertedAt`, `convertedClientId`), and optional `lostReason`.
- Lead relationship context is now first-class with lightweight `notes[]` and `activitySummary[]` timeline entries.
- Lead conversion flow now persists pipeline conversion state and returns conversion metadata with backward-compatible legacy CRM client linkage.
- CRM lead APIs now support scoped filtering (stage/owner/due follow-ups) and safe partial lead updates for stage/owner/follow-up/notes.
- CRM Leads UI now shows stage, owner, follow-up, conversion/downstream status, stage counters, and includes management controls for assignment, updates, and notes.
- CRM lifecycle documentation added at `docs/product/CRM_PIPELINE_MODEL.md`.

## April 2026: Embed Forms + Website Intake Integration for CMS

- Public forms now support explicit embed rendering mode using the same route shape (`/forms/:id?embed=true`) so firms can place Docketra intake on existing websites.
- Form records now include embed-focused settings: `allowEmbed`, `embedTitle`, `successMessage`, `redirectUrl`, `themeMode`, and optional `allowedEmbedDomains`.
- Public form submit now captures website-oriented source metadata (`submissionMode=embedded_form`, `source=website_embed`, page URL, referrer, UTM fields, form ID/slug).
- Embedded submissions continue through the shared CMS intake orchestration (`Lead -> optional Client -> optional Docket`) to preserve pipeline continuity.
- CMS module now exposes an **Embed on your website** section with public link, embed link, and ready-to-copy iframe embed code.
- Added conservative guardrails for embed intake: `isActive` + `allowEmbed` enforcement, optional domain allowlist check, and honeypot support.
- Embed submissions support stable post-submit behavior: inline success message and optional redirect URL when configured.

## April 2026: Module-Based UX Separation + Cleanup Fixes for CRM / CMS / Tasks

- Navigation now elevates **CMS**, **CRM**, and **Tasks** as first-class modules in the primary shell.
- Platform pages now include module context labels (for example: `CMS / Lead Capture`, `CRM / Relationship Management`, `Tasks / Dockets`).
- Dashboard now includes lightweight module entry shortcuts so teams can jump directly into CMS, CRM, or Tasks.
- Client status handling is now canonicalized to lowercase (`lead`, `active`, `inactive`) with compatibility normalization for legacy values (`ACTIVE`, `INACTIVE`).
- CMS intake client auto-create now supports canonical creation when **email OR phone** is available, while retaining duplicate-safe lookup first.
- Docket `isInternal` / `workType` normalization is now centralized to reduce drift and prevent contradictory values on reads/writes.
- Work-type filtering behavior is now normalized across docket list and reports for more consistent **Client Work** vs **Internal Work** behavior.
- Task UI copy is standardized to **Client Work** and **Internal Work**, including filters and guided creation text.
- Saved views now persist and restore `workType` filter state to avoid filter drift when users reload named views.

## April 2026: First-Class Internal Task Support

- Task Manager now supports both **Client Work** and **Internal Work** as first-class docket modes.
- Docket (`Case`) records now persist explicit work mode metadata (`isInternal`, `workType`) with backward-compatible defaults.
- Internal dockets can now be created without a `clientId`; client-linked creation remains unchanged for external work.
- Docket list and query APIs now accept work-mode filters (`isInternal` / `workType`) for operational views and reporting slices.
- Create Docket UI now allows users to choose **Client Work** vs **Internal Work** and conditionally requires client selection.
- Docket list/detail UI now surfaces work-type labels so teams can distinguish internal vs client queues quickly.

## April 2026: Unified CMS Intake Submission Pipeline

- CMS and public intake submissions now run through a shared orchestration service: `Submission -> Lead -> optional Client -> optional Docket`.
- Every CMS/public submission now creates a Lead first for consistent top-of-funnel tracking.
- Client and docket auto-creation are now config-driven via firm-level intake settings with safe defaults.
- CMS/public controllers were slimmed down so they parse request/response only; orchestration now lives in `cmsIntake.service`.
- Intake responses now return normalized status details (`lead`, `client`, `docket`, `submissionMode`, `metadata`) to support CRM/CMS/Task Manager consistency.

## Workflow + RBAC Core Architecture Upgrade

### Multi-workbasket user support
- Users can now be assigned to multiple workbaskets using `teamIds` (workbasket access list), while retaining a primary basket in `teamId`.
- New `GET /api/self/core-work` endpoint returns the current user's active workbaskets in the `[{ id, name, type }]` shape for multi-WB UI rendering.

### QC workbasket system
- Workbasket model now supports `type` (`PRIMARY`/`QC`) and `parentWorkbasketId` to represent explicit QC lanes.
- Creating a primary workbasket now auto-creates a paired QC workbasket (`<name> - QC`).
- Docket workflow transition to QC now attempts to route into the mapped QC workbasket for the current primary basket.

### Manager-based assignment control
- Workbasket management and user-to-workbasket assignment routes are now gated to `MANAGER` and `PRIMARY_ADMIN`.
- Introduced firm permission `WORKBASKET_MANAGE` and granted it to manager + primary admin roles only.
- Admins keep category/client management capability but are blocked from workbasket assignment operations.

### Strict routing + validation improvements
- Subcategories now require `workbasketId` mapping at data-model and request-validation levels.
- Subcategory create/update now validates that referenced workbasket is an active primary workbasket in the same firm.
- Case creation now routes to the subcategory-mapped workbasket and falls back to default active primary workbasket only when no subcategory mapping is involved.

### Client-level access readiness
- User model now includes `clientAccess` array support for explicit client-level allow-listing and response mapping.

### Operational guardrails
- Workbasket listing now returns a warning when no users are assigned:
  - `"No users assigned to this workbasket"`

## April 2026: Platform UI/UX Productivity Refresh

- Upgraded firm platform shell with improved sidebar grouping, sticky topbar clarity, and consistent primary actions.
- Added reusable platform UI primitives for page sections, filters, notices, metric grids, and resilient tables.
- Improved daily execution surfaces (My Worklist, Workbaskets, QC Queue) with filter/search, refresh controls, and better loading/empty/error states.
- Refined Dashboard, Reports, CRM, CMS Intake, and Settings pages for stronger information hierarchy and faster scanning.
- Standardized visible workflow terminology around **Docket** for better enterprise consistency and trust.

### April 2026: Platform UX refinement pass

- Topbar actions are now page-owned (no hardcoded shell actions), improving context clarity.
- Platform tables now include lightweight pagination with Previous/Next controls.
- Filter bars now include a consistent "Clear filters" action.
- Action layouts are standardized: primary entry first, secondary actions grouped, destructive actions visually distinct.
- Inline success notices were added to key queue actions (Worklist, Workbaskets, QC) for faster operator feedback.
- Accessibility improved with focus-visible styling and better disabled-state handling for controls.
