# CloudMailin Inbound Email Integration

Docketra leverages **CloudMailin** on its free tier (10,000 emails/month) to receive and parse incoming client reply emails with attachments, linking them directly to matching case files.

---

## 1. Webhook Endpoint
The public, unauthenticated webhook endpoint in production is:
`POST https://<backend-domain>/api/public/emails/inbound`

---

## 2. Inbound Email Flow

```
Client Reply Email
  │
  ▼
Cloudflare Email Routing (Wildcard)
  │
  ▼
CloudMailin Inbound Address (JSON-Normalized)
  │
  ▼
Docketra Webhook Endpoint (Express)
  │
  ▼
HMAC Signature & Whitelist Checks
  │
  ▼
Google Drive Upload & Case Auto-Reopen
```

---

## 3. Webhook Format (JSON - Normalized)
CloudMailin must be configured to deliver webhooks in **JSON (Normalized)** format.

### Expected Payload Shape:
```json
{
  "envelope": {
    "to": "docket-CO202603080001-f64a76@mail.docketra.in",
    "from": "client@company.com",
    "helo_domain": "mail.company.com",
    "remote_ip": "1.2.3.4"
  },
  "headers": {
    "from": "Test Client <client@company.com>",
    "to": "docket-CO202603080001-f64a76@mail.docketra.in",
    "subject": "Re: Document Request",
    "date": "Thu, 02 Jul 2026 10:45:00 +0000",
    "message_id": "<msg-id@company.com>"
  },
  "body": {
    "plain": "Hello, here are the requested documents attached.",
    "html": "<html><body><p>Hello, here are the requested documents.</p></body></html>"
  },
  "attachments": [
    {
      "file_name": "passport.pdf",
      "content_type": "application/pdf",
      "size": 1024,
      "content": "bW9jayBiYXNlNjQtZW5jb2RlZC1wZGYtY29udGVudA=="
    }
  ]
}
```

---

## 4. Environment Variables Required

```env
# 1. Active inbound domain where emails are received
INBOUND_EMAIL_DOMAIN=mail.docketra.in

# 2. Secret key used for cryptographic HMAC token checks
SYSTEM_HASH_SECRET=T1l4dmNtUXphRFpKYjNOMmRHVjVjMmx6ZEdsdmJtUnlaV055WlhSM2FXNW5iRzkxWlhSZk1USXpORFU9

# 3. Size limit for incoming JSON body (Required: 10mb for base64 attachments)
JSON_BODY_LIMIT=10mb
```

---

## 5. Security & Verification
1. **Stateless HMAC Check**:
   The controller parses the `To` header matching `docket-<caseNumber>-<secureToken>@domain.com`. The `<secureToken>` is compared against `HMAC-SHA256(caseInternalId, SYSTEM_HASH_SECRET)`.
2. **Sender Whitelist Check**:
   The controller decrypts the associated case client details using `ClientRepository.findById()` and verifies that the `from` sender email matches the registered business email. Invalid senders are rejected with `403 Forbidden`.
