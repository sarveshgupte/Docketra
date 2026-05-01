# Module Requirements (MVP vs Next)

## 1) Auth requirements
### MVP required
- Reliable login/logout across firm and superadmin surfaces.
- OTP and password reset flows must be production-safe.
- Session bootstrap/refresh and redirect handling must preserve intended destination and firm context.
- Auth failure paths must provide safe errors without leaking internals.

### Next
- Additional adaptive auth controls and richer session analytics.

## 2) Firm workspace routing requirements
### MVP required
- Every firm route must be anchored to `:firmSlug` context.
- Backend must enforce tenant context via middleware/invariants for all sensitive paths.
- Route aliases (legacy `/cases`) must remain compatibility-only; canonical language is dockets.

### Next
- Further route-contract automation and route inventory CI hardening.

## 3) CRM requirements
### MVP required
- Lead lifecycle stages and ownership updates.
- CRM client records and detail views.
- Reliable linkage from lead/client to docket creation where applicable.

### Next
- Advanced segmentation/scoring and richer CRM automation.

## 4) CMS/document requirements
### MVP required
- Intake via hosted forms, embeds, and API.
- Intake records should map to CRM and optionally docket creation flows.
- Form configuration must be role-restricted and tenant-scoped.

### Next
- Template marketplace and more advanced intake automation logic.

## 5) Docket/task requirements
### MVP required
- Docket CRUD + lifecycle transitions with audit context.
- Worklist, workbaskets, QC queue, assignment/reassignment flows.
- Attachments and comments with proper authorization checks.

### Next
- Advanced SLA optimization and predictive routing.

## 6) BYOS/storage requirements
### MVP required
- BYOS-first guidance in onboarding/tutorial.
- If BYOS is skipped, secure Docketra-managed storage fallback.
- Firm-owned storage links/config should be tenant-scoped and auditable.

### Next
- Deeper provider expansion and automated storage governance policies.

## 7) Superadmin requirements
### MVP required
- Firm administration, onboarding insight views, and diagnostics.
- Strong separation between platform ops and firm business-data operations.

### Next
- Enhanced fleet analytics and incident tooling.

## 8) Reports/diagnostics requirements
### MVP required
- Role-aware operational reporting for firm execution.
- Diagnostics surfaces and runbooks for auth/upload/performance incidents.
- Redaction-safe logs and traceability IDs.

### Next
- Historical trend intelligence and custom report composer.

## 9) UI/UX requirements
### MVP required
- No broken navigation entries.
- No production pages that are pure placeholders/dead ends.
- Role-aware navigation labels should reflect integrated CRM+CMS+docket model.
- Loading/empty/error states for all primary module pages.

### Next
- Deeper personalization and high-density operational layouts.

## 10) Performance expectations
### MVP required
- Core pages (dashboard, worklist, docket detail, CRM lists) should load consistently under pilot-scale data.
- API and UI should include baseline protections (pagination, throttling, fallbacks) to avoid degradation.

### Next
- Advanced caching strategies and latency SLO dashboards.

## 11) Error handling requirements
### MVP required
- Structured server errors with safe client messaging.
- Retry-safe patterns for async flows where possible.
- Operational diagnostics should expose actionable, non-sensitive context.

### Next
- Unified incident signature catalog with auto-remediation hooks.
