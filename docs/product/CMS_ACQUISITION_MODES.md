# CMS Acquisition Modes

Docketra CMS supports three acquisition modes so firms can capture intake in the channel that matches their operating model.

## 1) Docketra-hosted landing pages

- Firm creates and publishes a landing page in Docketra CMS.
- Public visitors submit intake via Docketra-hosted page routes.
- Submission enters unified intake orchestration and creates a Lead first.

## 2) Embedded website forms

- Firm uses Docketra form link in embedded mode (`/forms/:id?embed=true`) inside their own website via iframe.
- CMS exposes copy-ready embed information:
  - Public form link
  - Embed link
  - Iframe snippet
- Submission still uses shared intake orchestration:
  - `Lead -> optional Client -> optional Docket`
  - auto-create behavior is resolved from firm intake config (not hard-disabled in public/embed handlers)

### Embed metadata captured

Embedded submissions capture source metadata for attribution and reporting:

- `submissionMode = embedded_form`
- `source = website_embed`
- `formId` / `formSlug`
- `referrer`
- `pageUrl`
- UTM tags when present (`utm_source`, `utm_campaign`, `utm_medium`)
- intake/user context (`service`, `message`, `ipAddress`, `userAgent`, `pageSlug` when available)

This attribution metadata is persisted directly on `Lead.metadata` for CRM listing/detail usage and reporting.

### Public/embed field rendering behavior

Public and embedded forms render from each form record’s configured `fields` array.

- `form.fields` is the source of truth for render order, labels, and field type.
- Supported field types are currently: `text`, `email`, `phone` (unknown types fall back safely to text input).
- Default fallback fields (`name`, `email`, `phone`) are used only if no explicit fields were configured.
- Public/embed forms require a `name` field for compatibility with the unified intake pipeline.

### Guardrails

- `isActive` and `allowEmbed` enforced before embed submission is accepted.
- Optional `allowedEmbedDomains` provides lightweight origin/referrer validation when headers are available.
- Honeypot field support is included to reduce basic spam bots.

## 3) Direct API/webhook intake

- Firms can send leads/intake directly into Docketra via integration endpoint:
  - `POST /public/cms/:firmSlug/intake`
- Requests must include firm-level intake auth header:
  - `x-docketra-intake-key`
- Intake is validated, rate-limited, and routed through shared orchestration:
  - `Lead -> optional Client -> optional Docket`
- API intake metadata is labeled for attribution/reporting:
  - `submissionMode = api_intake`
  - default `source = api_integration` (explicit source preserved if provided)
- Optional idempotency support is available via:
  - `idempotencyKey` / `externalSubmissionId` (or `idempotency-key` header)

---

## Unified downstream pipeline

Regardless of acquisition mode, Docketra uses a unified intake flow:

1. Create Lead in CRM-intake context
2. Optionally create canonical Client (config-driven)
3. Optionally create Docket (config + routing dependent)

This keeps CMS/CRM/Tasks consistent and avoids channel-specific business logic forks.
