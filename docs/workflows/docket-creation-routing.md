# Docket Creation & Routing (Practical Reference)

## 1) Creation entry points
- **Manual create:** `GuidedDocketForm` → `POST /api/dockets`.
- **Public/embed form:** `PublicFormPage` → `POST /api/public/forms/:id/submit`.
- **CRM/CMS handoff:** `form.controller.submitForm` → `cmsIntake.service.processCmsSubmission`.
- **API intake:** public intake API routes → `processCmsSubmission` (`submissionMode=api_intake`).

## 2) Client resolution rules
- **Manual create:** use selected client; if missing, resolve firm default client.
- **Manual create hard-stop:** block if resolved client is inactive or belongs to another firm.
- **CMS/API intake:**
  - if `autoCreateClient=true`, match by email/phone first;
  - create new client only when no match and contact data is sufficient;
  - if no contact data, skip client creation with warning.

## 3) Routing/workbench mapping rules
- **Manual create:**
  - category must be active,
  - subcategory must belong to category and be active,
  - subcategory must map to a workbench.
- **CMS/API intake:**
  - prefer configured default category/subcategory,
  - else map from `service`,
  - mapped workbench must exist and be active,
  - invalid/missing mapping returns warning and skips docket auto-create.

## 4) Fallback behavior
- No silent routing fallback to broken targets.
- Missing canonical client in intake path skips docket auto-create with explicit warning.
- Intake returns outcome metadata so staff can recover manually.

## 5) Duplicate-prevention safeguards
- Manual create UI blocks repeated in-flight submits and sends `idempotencyKey`.
- Docket create endpoint supports idempotent replay by key.
- Public/embed intake replay now scopes by:
  - `firmId`,
  - `submissionMode`,
  - primary form scope token (`formId`, else `formSlug`, else `pageSlug`),
  - `idempotencyKey`.
- CMS-created dockets receive deterministic intake-derived idempotency keys.

## 6) Partial-failure handling
- Intake captures step-level workflow signals (`workflowSteps`) for:
  - replay detection,
  - lead creation,
  - client resolution,
  - routing resolution,
  - docket creation.
- User-facing result does not report fake success when routing/client prerequisites fail.

## 7) Remaining workflow risks
- Some non-form ingestion paths still rely on path-specific idempotency behavior.
- Poor intake contact quality can still require manual client cleanup.
- Recovery remains operator-driven (auditable), not full transactional rollback across all steps.
