# CMS API Intake (Webhook/Direct Integration)

Docketra supports direct intake ingestion for firms that already use custom websites, third-party form systems, or automation tools.

This mode converges into the same CMS orchestration used by hosted and embedded forms:

`Submission -> Lead -> optional Client -> optional Docket`

## Endpoint

- `POST /public/cms/:firmSlug/intake`
- Legacy API prefix also works: `POST /api/public/cms/:firmSlug/intake`

## Authentication

Pass the firm-level intake API key in header:

- `x-docketra-intake-key: <firm_intake_api_key>`

The firm must have `intakeConfig.cms.intakeApiEnabled = true` and a configured `intakeConfig.cms.intakeApiKey`.

## Payload

Minimum required field:

- `name`

Recommended fields:

- `email`
- `phone`
- `source` (optional override; defaults to `api_integration`)
- `service`
- `message`
- `pageUrl`
- `referrer`
- `utm_source`
- `utm_campaign`
- `utm_medium`
- `externalSubmissionId` (optional idempotency support)
- `idempotencyKey` (optional idempotency support)

Additional custom fields are accepted and stored in `Lead.metadata.extraFields`.

## Example request

```bash
curl -X POST "https://<your-domain>/public/cms/acme-advisors/intake" \
  -H "Content-Type: application/json" \
  -H "x-docketra-intake-key: YOUR_INTAKE_KEY" \
  -H "idempotency-key: zapier-run-2026-04-18-001" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1-202-555-0147",
    "source": "zapier_wordpress",
    "service": "GST Filing",
    "message": "Need help with Q2 filing",
    "pageUrl": "https://firmsite.com/intake",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "q2-intake",
    "externalSubmissionId": "wp-entry-8877",
    "custom_form_name": "wordpress_tax_contact"
  }'
```

## Success response

```json
{
  "success": true,
  "leadId": "...",
  "clientId": "C000123",
  "docketId": "CASE-20260418-00001",
  "warnings": [],
  "submissionMode": "api_intake",
  "idempotentReplay": false
}
```

## Replay response (idempotency)

If the same idempotency value is retried, Docketra returns the existing lead safely:

- status: `200`
- `idempotentReplay: true`

## Common failures

- `400` invalid payload (for example missing `name`)
- `401` missing/invalid `x-docketra-intake-key`
- `403` intake API disabled for the firm
- `404` unknown firm slug
- `429` rate limited

## Downstream mapping

Every accepted API intake request is tagged with `submissionMode = api_intake` and then processed through the same orchestration pipeline:

1. Lead creation in CRM context
2. Optional canonical Client creation (firm config-driven)
3. Optional Docket creation (routing + firm config-driven)
4. Metadata persisted for CRM visibility/reporting
