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

### Embed metadata captured

Embedded submissions capture source metadata for attribution and reporting:

- `submissionMode = embedded_form`
- `source = website_embed`
- `formId` / `formSlug`
- `referrer`
- `pageUrl`
- UTM tags when present (`utm_source`, `utm_campaign`, `utm_medium`)

### Guardrails

- `isActive` and `allowEmbed` enforced before embed submission is accepted.
- Optional `allowedEmbedDomains` provides lightweight origin/referrer validation when headers are available.
- Honeypot field support is included to reduce basic spam bots.

## 3) Direct API/webhook intake

- Firms can send leads/intake directly into Docketra via integration endpoints.
- Intake still maps into the same CMS orchestration and CRM/Tasks handoff model.
- This mode is intended for custom websites, automation tools, and middleware platforms.

---

## Unified downstream pipeline

Regardless of acquisition mode, Docketra uses a unified intake flow:

1. Create Lead in CRM-intake context
2. Optionally create canonical Client (config-driven)
3. Optionally create Docket (config + routing dependent)

This keeps CMS/CRM/Tasks consistent and avoids channel-specific business logic forks.
