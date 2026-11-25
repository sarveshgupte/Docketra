# Automated Email Campaigns: DocketsHQ

This document records the automated email architecture, live Brevo templates, and drip sequences configured for the **DocketsHQ Pioneer 30 Launch** (November 26, 2026).

* **Active Sender**: `Sarvesh Gupte <hello@docketshq.com>`
* **Reply-To**: `hello@docketshq.com` (routed via Cloudflare Email Routing directly to founder Gmail)
* **Brevo List**: `DocketsHQ Pioneer Outreach` (List ID: `5`)
* **Infrastructure**: Brevo REST API v3 (`https://api.brevo.com/v3`) + Cloudflare DNS (DKIM & SPF verified)

---

## 1. Live Brevo Email Templates

All 5 templates have been created, formatted with responsive B2B styling, and activated in Brevo:

| Template ID | Name | Subject | Timing | Target Outcome |
| :---: | :--- | :--- | :--- | :--- |
| **#1** | `DocketsHQ Pioneer 1: Founder Birthday Launch` | *An invitation for your firm (and a personal birthday milestone)* | Day 0 (Nov 26) | Founder milestone story, 1-year free pilot for 30 firms, ₹12,990/yr lifetime renewal rate thereafter. |
| **#2** | `DocketsHQ Pioneer 2: 60-Second Video Demo` | *How to turn a 40-message WhatsApp dump into an audit docket in 60s* | Day +2 (Nov 28) | Overcoming client resistance; 1-click Client Drop link demonstration. |
| **#3** | `DocketsHQ Pioneer 3: Google Drive Safety & Cryptographic Shield` | *Can DocketsHQ see your existing Google Drive folders? (The technical proof)* | Day +5 (Dec 01) | Overcoming the #1 trust objection; explaining restricted `drive.file` OAuth scope. |
| **#4** | `DocketsHQ Pioneer 4: Form 3CD & 4-Eye Review` | *Tax Audit Form 3CD with a day-one intern (Zero partner panic)* | Day +9 (Dec 05) | Showcasing pre-loaded Statutory Blueprints and mandatory 4-eye partner sign-off. |
| **#5** | `DocketsHQ Pioneer 5: Final 48-Hour Scarcity Window` | *Closing the Pioneer 30 Cohort this Saturday* | Day +13 (Dec 09) | Scarcity trigger; locking the ₹12,990 lifetime rate before regular ₹17,990 applies. |

---

## 2. Brevo Automated Drip Workflow Configuration

To trigger this sequence automatically when adding new prospective CA/CS firm contacts:

```text
Trigger: Contact added to List #5 ("DocketsHQ Pioneer Outreach")
    │
    ▼
Send Email: Template #1 ("Founder Birthday Launch")
    │
    ▼
Delay: 2 Days
    │
    ▼
Send Email: Template #2 ("60-Second Video Demo")
    │
    ▼
Delay: 3 Days
    │
    ▼
Send Email: Template #3 ("Google Drive Safety & Cryptographic Shield")
    │
    ▼
Delay: 4 Days
    │
    ▼
Send Email: Template #4 ("Form 3CD & 4-Eye Review")
    │
    ▼
Delay: 4 Days
    │
    ▼
Send Email: Template #5 ("Final 48-Hour Scarcity Window")
    │
    ▼
Exit Condition: Contact registers on docketshq.com -> Removed from Outreach, moved to Onboarding List.
```

---

## 3. How to Add Contacts to the Automation

### Method A: Via Brevo Dashboard
1. Go to **Contacts** $\rightarrow$ **Lists** $\rightarrow$ Click **DocketsHQ Pioneer Outreach** (List ID `5`).
2. Click **Add contacts** $\rightarrow$ Upload CSV (Name, Email, Firm Name, City).
3. The automated drip begins immediately for each contact.

### Method B: Via API / Node Script
```javascript
const https = require('https');

function addContactToPioneerList(email, firstName, firmName) {
  const postData = JSON.stringify({
    email,
    attributes: { FIRSTNAME: firstName, FIRM_NAME: firmName },
    listIds: [5],
    updateEnabled: true
  });

  const req = https.request('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json'
    }
  }, (res) => {
    console.log('Contact added:', res.statusCode);
  });
  req.write(postData);
  req.end();
}
```

---

## 4. Deliverability Guardrails

* **SPF / DKIM / DMARC Alignment**: All emails are signed by `b1.docketshq-com.dkim.brevo.com` and `b2.docketshq-com.dkim.brevo.com` with 0 SPF errors.
* **Inbound Replies**: Any replies to `hello@docketshq.com` are captured by Cloudflare Email Routing and forwarded to the founder inbox (`guptesarvesh@gmail.com`).
* **Unsubscribe Compliance**: Every template includes an active `{{ unsubscribe }}` tag to maintain sender reputation across Indian corporate firewalls and Gmail Spam filters.
