# CRM + Intake Workflow Lifecycle

## Purpose

This workflow ensures intake operations behave like production business flow, not side modules:

1. Capture intake with explicit source attribution.
2. Detect likely duplicates early.
3. Convert intake lead to client and then docket with clear auditability.
4. Return actionable recovery guidance when conversion steps fail.

## Lifecycle: intake lead → client → docket

### 1) Intake lead creation

Intake starts from one of:
- Public form (`submissionMode=public_form`)
- Embedded form (`submissionMode=embedded_form`)
- API intake (`submissionMode=api_intake`)
- Internal CMS submit (`submissionMode=cms`)

Each lead stores source attribution in `metadata.sourceAttribution`:
- source + submission mode
- channel classification
- page URL + referrer
- form identifiers
- UTM campaign values
- external submission and idempotency references

### 2) Duplicate warning stage

Before conversion, intake checks existing leads/clients (firm-scoped) for likely duplicates using:
- email
- phone
- PAN / GST / GSTIN (if present in intake payload)
- client code / firm identifier (if present)

Duplicates do not hard-block intake. Instead, warning details are attached to intake diagnostics so operators can review and merge intentionally.

### 3) Intake to client conversion

If auto-create client is enabled:
- Existing client is matched by email/phone.
- Otherwise a new canonical client is created.

If conversion fails, the lead is retained and warning details include:
- reason code
- clear message
- recovery action text

### 4) Intake to docket conversion

If auto-create docket is enabled:
- Routing config is validated.
- Docket is created only when routing + client resolution are valid.
- Docket audit event is written (`DOCKET_CREATED`) with intake context.

If conversion fails, lead/client state remains intact and warning details include recovery actions (e.g., fix routing/client linkage and retry).

### 5) Audit trail

`metadata.intakeDiagnostics` now records workflow and conversion traceability:
- `workflowSteps` (step + status)
- `warningDetails` (reason code + recovery)
- `conversionTrail` (client/docket conversion attempt outcomes)
- `lastFailureReason`

This trail supports operations review and reliable retry behavior.

## Operator guidance

On CRM/CMS pages:
- Intake queue now surfaces source detail and recovery hints for warnings.
- Empty states explain first-step actions (publish form, submit test intake, adjust filters).
- Lead pipeline empty states explain how intake submissions flow into CRM.
