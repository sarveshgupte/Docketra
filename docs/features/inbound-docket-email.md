# Inbound Docket Email

## Product Intent

Each docket should have a unique inbound email address. When a client, team member, or external party sends email to that address, Docketra should attach the email context to the docket automatically.

Example:

```text
dk_8H3K92P@reply.docketra.in
```

The alias must be random and unguessable. Do not expose predictable docket IDs such as `DOCKET-20260421-00001@...` as public inbound addresses.

## Expected User Experience

- Docket Overview shows a copyable "Forward emails to this docket" address.
- Incoming email subject and body become a docket comment.
- Email attachments become docket attachments.
- A timeline/activity event records that an inbound email was received.
- Users should not have to open a separate Email Logs tab for day-to-day execution.

Recommended docket surface:

- `Overview`: display/copy the inbound email alias.
- `Comments`: show the email subject/body as a system-authored comment.
- `Attachments`: show files extracted from the email.
- `Activity`: show inbound email received, sender, timestamp, and attachment count.

## Recommended Provider Direction

Use Cloudflare Email Routing plus an Email Worker for inbound docket mail.

Keep Brevo for outbound transactional email such as OTPs, invites, and notifications.

Why Cloudflare:

- low-cost/free inbound routing for early scale
- supports routing domain email to Workers
- can process catch-all aliases such as `*@reply.docketra.in`
- works well with a random alias model
- lets Docketra own the parsing, storage, and audit workflow

Tradeoff:

- Cloudflare provides the raw MIME email stream. Docketra must parse it, likely with a library such as `postal-mime`, instead of receiving already-normalized JSON from Brevo inbound parsing.

## Domain And DNS Model

Use a dedicated inbound subdomain, not the primary marketing/login domain.

Recommended:

```text
reply.docketra.in
```

This keeps inbound docket routing separate from normal human inboxes and outbound sender reputation.

Future DNS setup:

- Buy/configure `docketra.in`.
- Move DNS management to Cloudflare.
- Enable Cloudflare Email Routing for `reply.docketra.in`.
- Add catch-all or route rules for docket aliases.
- Route matching inbound messages to the Email Worker.

Gmail can continue to be used for normal personal/business email. The inbound docket subdomain should be separate from Gmail-hosted inboxes.

## Technical Flow

```text
External sender
  -> dk_<random-token>@reply.docketra.in
  -> Cloudflare Email Routing
  -> Cloudflare Email Worker
  -> Docketra webhook
  -> resolve alias to docket
  -> create comment from subject/body
  -> create attachments from email files
  -> create activity/audit event
```

## Data Model Additions

Add a durable inbound alias mapping.

Suggested fields on the docket or a dedicated alias collection:

```text
firmId
caseInternalId
caseId
inboundEmailAlias
inboundEmailLocalPart
inboundEmailDomain
status: active | disabled
createdAt
disabledAt
lastReceivedAt
```

Alias generation requirements:

- random token, not derived directly from docket ID
- unique per firm/domain
- immutable for a docket unless explicitly rotated
- disabled when a docket is archived or inbound email is turned off

## Backend API Shape

The Cloudflare Worker should POST a normalized payload into Docketra.

Suggested endpoint:

```text
POST /api/webhooks/inbound-email/cloudflare
```

Webhook requirements:

- verify shared secret or signed request from the Worker
- reject unknown aliases
- enforce firm/docket tenant boundary
- deduplicate by email `Message-ID`
- store raw metadata enough for audit and troubleshooting
- cap body and attachment sizes
- virus/spam handling policy before attachment publication

Suggested normalized payload:

```json
{
  "alias": "dk_8H3K92P@reply.docketra.in",
  "messageId": "<message-id@example.com>",
  "from": { "email": "client@example.com", "name": "Client Name" },
  "to": ["dk_8H3K92P@reply.docketra.in"],
  "cc": [],
  "subject": "GST documents for filing",
  "textBody": "Please find attached...",
  "htmlBody": "<p>Please find attached...</p>",
  "receivedAt": "2026-06-05T14:30:00.000Z",
  "attachments": [
    {
      "fileName": "gst-data.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "size": 24012,
      "contentBase64": "<base64>"
    }
  ]
}
```

For large attachments, prefer temporary object storage references over base64 payloads.

## Docket Comment Format

System-created comment:

```text
Email received from Client Name <client@example.com>
Subject: GST documents for filing

Please find attached...
```

The comment should be clearly marked as email-originated and should link to the corresponding activity/audit event.

## Attachment Handling

Email attachments should become regular docket attachments with source metadata.

Suggested attachment metadata:

```text
source: email
sourceEmailMessageId
sourceEmailFrom
sourceEmailSubject
uploadedBy: system
uploadedByXID: SYSTEM
```

Attachments should follow existing storage rules, firm-owned storage policy, and tenant isolation.

## Security And Abuse Controls

- Random aliases only.
- Webhook signature/shared secret verification.
- Message-ID dedupe.
- Max email size.
- Max attachment count and size.
- Allowed/blocked MIME type policy.
- Spam score or sender trust policy before auto-posting.
- Audit log for every accepted/rejected inbound email.
- Never let inbound email create cross-firm data linkage.

## Existing Groundwork

The repository already contains partial email capture infrastructure:

- `src/models/EmailCapture.model.js`
- `src/controllers/emailCapture.controller.js`
- `ui/src/pages/caseDetail/CaseDetailEmailsPanel.jsx`

This existing path is manual/simulated. The future feature should convert it into a real inbound pipeline and avoid exposing a separate Email Logs tab unless there is a clear operational need.

## Open Decisions

- Whether to store raw `.eml` files for audit.
- Whether inbound email should be allowed after a docket is resolved/filed.
- Whether non-client senders should be accepted by default or held for review.
- Whether high spam score emails should create private audit entries only.
- Whether aliases should be shown to all docket users or only managers/admins.

