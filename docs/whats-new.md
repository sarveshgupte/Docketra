# What's New

## April 2026: Sidebar Information Architecture Refactor (Workflow-Aligned)

- Refactored the firm sidebar to preserve the existing compact shell while reorganizing navigation into **Overview**, **Modules**, **Workspace**, and **Administration** sections.
- Introduced expandable module groups for **CRM**, **CMS**, and **Task Manager** with route-aware open/active behavior and keyboard-accessible toggles.
- Moved **Client Management** under CRM and removed standalone top-level Clients navigation to align entity management under the CRM module.
- Renamed **Tasks** navigation concept to **Task Manager** and clarified execution ownership for Workbasket, My Worklist, QC Workbasket, Dockets, and Category Management.
- Kept CMS navigation focused on intake/request surfaces and avoided exposing any misleading standalone documents repository destination.
- Reaffirmed product behavior that document collection remains inside **Docket → Attachments**, not as a global CMS “Documents” page.
- Clarified Category Management as the primary configuration anchor for category/subcategory/workbasket mapping workflows under Task Manager.
- Improved role-aware visibility so operational configuration entries only appear for authorized users.


## April 2026: Role-specific onboarding tutorial upgrade

- Replaced the first-login single-page tutorial with a multi-step guided flow that explains: what Docketra is, role scope, allowed actions, where to begin, and a role-based quick-start checklist.
- Added role-specific onboarding content for **Superadmin**, **Primary Admin**, **Admin**, **Manager**, and **User**.
- Upgraded dashboard product tour to include role-aware, practical steps with direct navigation actions to relevant pages.
- Added manual relaunch controls in Help & Onboarding for both tour replay and welcome tutorial replay.
- Improved first-session empty-state guidance to reduce confusion when dockets or assignments are not yet configured.
- Added richer onboarding persistence (`tutorialState`) while retaining backward compatibility with `tutorialCompletedAt`.
- Added implementation documentation: `docs/onboarding-role-tutorial-flow.md`.

## April 2026: Legal & Compliance Pages

- Added a new **Terms of Use** page with clear coverage for service scope, account responsibilities, acceptable use, data ownership, early-stage availability, liability limits, terms updates, and contact details.
- Added a rewritten **Privacy Policy** in plain language covering data categories, usage purpose, sharing boundaries, storage approach, safeguards, user controls, cookies/tracking, and broad alignment with applicable Indian IT/data protection expectations.
- Added a practical **Data & Security Overview** page describing Docketra's firm-owned data model, BYOS/BYOAI direction, intake-to-CRM-to-task data flow, shared responsibility on backups, and baseline security approach.
- Added an **Acceptable Use Policy** page to state clear prohibitions on illegal activity, harmful content, and platform exploitation attempts.
- Added legal/compliance footer links across marketing and in-app layouts to improve trust, transparency, and discoverability.

## April 2026: Performance and Speed Improvements

- Reduced unnecessary frontend refetching in CRM lead workflows by applying local state patching for lead creation and updates, including optimistic stage transitions with failure rollback.
- Improved perceived speed in CRM/CMS surfaces by keeping existing data visible during background refreshes and moving to button-level refresh indicators instead of hard page-blocking loaders.
- Tuned React Query defaults and key dashboard/list hooks with practical stale/cache windows to avoid excessive remount/navigation refetches for stable data.
- Split category-count fetching from docket list fetching so category metadata is cached independently and not re-requested on every list filter change.
- Added backend lead-list projection to trim list payload size, plus no-op lead update write-skipping to avoid unnecessary database writes on unchanged updates.
- Added targeted lead query indexes for common firm-scoped owner/stage/follow-up list paths to improve hot-path query efficiency on free-tier MongoDB.
- Improved route-level loading copy to better explain startup latency during backend wake-up on Render free-tier cold starts.

## April 2026: Landing Page Visual Improvements

- Replaced all placeholder “Mock UI panel” blocks on the marketing landing page with realistic product-driven visuals based on Docketra workflows.
- Added visual walkthrough cards for Dashboard, CRM pipeline, CMS intake submissions, and Task/docket execution so new users can quickly understand how the platform works end to end.
- Added conversion-focused captions and realistic firm-style examples (GST Filing, ROC Return, Compliance Review) to improve trust and product clarity for first-time visitors.
- Added a lightweight “Before vs After” micro-visual to communicate the shift from scattered tooling to a connected CMS → CRM → Tasks operating flow.

## April 2026: UI/UX Improvements

- Dashboard usability polish: added quick actions (`+ New Lead`, `+ New Docket`, `+ Internal Task`), cleaner sectioning for Leads/Tasks/Recent Activity, and clearer empty-state guidance for faster first actions.
- Forms now have more consistent feedback states across inputs/selects/textareas, including success visuals, stronger focus/error treatment, required field clarity, and improved inline guidance.
- CRM lead flow now provides clearer inline validation during lead creation, stronger overdue follow-up visibility, and more actionable update errors/success messages.
- Task creation flow now supports faster work-type switching (Client Work vs Internal Task) with fewer clicks and clearer required-field behavior.
- Login/OTP experience improved with clearer, actionable auth error copy, stronger success feedback, OTP digit-by-digit entry with paste support, and resend timer feedback.
- Feedback system messaging is more contextual across key actions (lead creation/update, docket creation, login, OTP verification), replacing generic status text with task-specific messages.

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

## April 2026: Marketing Landing Page Redesign for Clarity + Trial Conversion

- Rebuilt the public homepage information architecture to clearly explain: what Docketra is, who it is for, how it works, feature modules, outcomes, and why teams should try it now.
- Repositioned homepage messaging around the connected operating model: `CMS -> CRM -> Tasks`.
- Added cleaner conversion structure: Hero CTAs, problem section, simple operating flow, grouped feature cards, outcomes, onboarding steps, FAQ, and final conversion CTA.
- Updated public pricing narrative to match current product status: **Early Access is free**, **no billing/subscriptions live yet**, and transparent testing-phase messaging.
- Updated public-facing contact touchpoints to use `sarveshgupte@gmail.com`.
- Removed outdated/incorrect company references from public marketing/legal pages where landing visitors are likely to evaluate trust.
- Added new positioning documentation at `docs/product/LANDING_PAGE_POSITIONING.md` for future copy/design consistency.

## April 2026: CRM Pipeline View

- Added a new **Pipeline View** toggle in CRM Leads so teams can switch between the existing List View and a new visual Kanban-lite layout.
- Leads are now grouped by stage (`New`, `Contacted`, `Qualified`, `Converted`, `Lost`) in horizontally scrollable columns with per-stage counts for fast pipeline scanning.
- Each pipeline card highlights lead owner, follow-up date, and a clear overdue indicator when follow-up is missed.
- Added lightweight stage movement controls directly on pipeline cards using the existing lead update APIs (no drag-and-drop complexity introduced).
- Clicking a pipeline card opens the existing lead management detail modal for deeper updates and activity visibility.
- Added a top-level `+ New Lead` action consistent across CRM views to speed up pipeline intake.

## April 2026: Data-driven onboarding setup progress

- Upgraded dashboard onboarding checklist to use real backend signals instead of mostly manual/local progress toggles.
- Added `GET /api/dashboard/onboarding-progress` to return role-aware setup step status with `detected` vs `manual` completion source.
- Added conservative detection across Primary Admin/Admin/Manager/User for setup readiness (clients, categories/workbaskets, queue visibility, assigned dockets, workflow interaction).
- Checklist now shows clearer completion reasons and waiting states to improve trust.
- Incomplete checklist steps now route users directly to role-appropriate setup pages.
- Dashboard empty state for no dockets now references real setup blockers (for example, missing active client or missing category/workbasket setup).

- Made onboarding-progress dashboard fetch non-blocking so checklist API issues do not degrade core dashboard load.
- Separated checklist CTA navigation from completion state for detected steps to preserve backend-driven truth.
