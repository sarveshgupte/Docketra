# CRM/CMS Hardening (Pilot Readiness)

## 1) Page / component breakdown
- **CRM**
  - `ui/src/pages/crm/CrmClientsPage.jsx`: clients list, filters, create/edit modal.
  - `ui/src/pages/crm/LeadsPage.jsx`: lead queue, pipeline board, lead create/manage modals.
- **CMS**
  - `ui/src/pages/platform/CmsPage.jsx`: form management + intake queue summary.
  - `ui/src/pages/PublicFormPage.jsx`: public/embed intake submission UI.
- **Backend handoff path**
  - `src/controllers/form.controller.js` → `src/services/cmsIntake.service.js`.

## 2) Hooks / helpers introduced
- `createSubmissionKey()` in `PublicFormPage.jsx`.
  - Generates client-side idempotency keys for public/embed submits.
- `validateUniqueFieldKeys()` in `form.controller.js`.
  - Rejects duplicate form field keys (case-insensitive) on create/update.

## 3) Validation + submit rules
- **CRM client form**
  - Name required.
  - Email optional, format-validated if present.
  - Phone optional, format-validated if present.
  - Submit guarded by `saving` (double-click protection).
- **CRM lead form**
  - Name required.
  - At least one contact method required (email or phone).
  - Email/phone format-validated when present.
  - Submit guarded by `saving`.
- **CMS form config (admin)**
  - `name` field required for public/embed compatibility.
  - Duplicate field keys rejected server-side.
- **Public/embed intake submit**
  - Required/format validation runs before API call.
  - Submission includes `idempotencyKey`.

## 4) CRM/CMS → Docket handoff rules
- Intake service validates base payload (`name`, anti-spam checks).
- Metadata and `intakeOutcome` are normalized and attached to lead records.
- Client is upserted only when config allows and sufficient contact data exists.
- Docket is created only when:
  - auto-create is enabled,
  - routing resolves,
  - canonical client is available.
- If routing/client preconditions fail, warnings are captured in outcome (no silent failure).

## 5) Duplicate-prevention safeguards
- UI submit guards on CRM/CMS forms prevent duplicate clicks.
- Public/embed submits carry `idempotencyKey`.
- Intake service returns existing lead for repeated `idempotencyKey` (same firm + mode), avoiding duplicate lead/client/docket creation.
- Form-definition duplicate field keys are blocked at controller level.

## 6) Biggest remaining pilot-readiness gaps
- Lead conversion concurrency and visibility can still benefit from stronger operational telemetry.
- CRM/CMS pages still rely mostly on page-local state (limited shared caching/query patterns).
- Public intake UX is intentionally simple; additional accessibility and field-help improvements remain.
