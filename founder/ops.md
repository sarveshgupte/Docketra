# Operations Manual & Day-One SOPs: Docketra

This operational manual defines how Docketra runs on day one, week one, and month one. Every process is designed to ensure the operational stability of a B2B SaaS serving practicing Indian Chartered Accountants (CAs), Company Secretaries (CSs), and corporate compliance practices.

All cost figures and unit inputs trace to [`founder/numbers.json`](./numbers.json), [`founder/cfo.md`](./cfo.md), and [`founder/offer.md`](./offer.md).

---

## 1. What the Business Does Every Day (The Daily Cycle)

Indian CA and CS firms operate on an intense statutory rhythm: morning staff arrival (09:00 IST), client document dumps throughout the day, maker-checker document reviews by partners in late afternoon, and portal uploads until night during filing cutoffs (ITR July/Oct, ROC Oct/Nov, GST 11th/20th of every month).

Docketra’s internal daily operations cycle:

| Time (IST) | Internal Step | Description | Customer Visible? |
|---|---|---|:---:|
| **08:30** | **Health & Queue Check** | Inspect Render API health, MongoDB Atlas connection pools, Redis queue latency, and background worker status. | No |
| **09:00** | **Inbound Support & Triage** | Review support inbox (`help@docketra.in`) and WhatsApp Concierge channel for firm admin questions. | **Yes** |
| **10:00** | **Concierge Migration Processing** | Ingest client roster spreadsheets submitted overnight by new firms; run deduplication scripts and import into firm databases within the 24-hr guarantee window. | **Yes** (Notification on completion) |
| **12:00** | **Google OAuth Telemetry Audit** | Check Google Drive API rate-limit headroom and expired refresh-token error counts to proactively alert partners whose Google Workspace credentials need re-linking. | No |
| **14:00** | **Onboarding Demo / Concierge Call** | 20-minute live screen-share walkthrough with newly signed Managing Partners: connecting Drive, inviting trainees, and generating first statutory compliance dockets. | **Yes** |
| **16:30** | **Support Triage & Bug Reproduction** | Review Sentry exception logs; address clerk friction points (file upload timeouts, incorrect statutory date calculations). | **Yes** (Ticket response) |
| **18:30** | **Payment & Subscription Review** | Verify Razorpay daily webhooks: handle failed renewals, pioneer coupon activations, and invoice generation. | **Yes** (Automated GST invoice) |
| **19:30** | **Daily Close & Backup Verification** | Verify automated MongoDB Atlas daily snapshot completion and Redis state health. Document open issues for morning triage. | No |

---

## 2. Suppliers

Every external component in Docketra's operations stack has verified public pricing, SLAs, and payment terms:

| Supplier | Function | Public Pricing | Payment Terms | Lead Time | Backup Supplier |
|---|---|---|---|---|---|
| **[Render](https://render.com/pricing)** | Web Service & API Hosting | $25/mo (~₹2,100/mo) for Standard Web Service (2 GB RAM, 1 CPU) | Credit Card, Monthly post-paid | Immediate (Instant deploy) | [DigitalOcean App Platform](https://www.digitalocean.com/pricing/app-platform) ($24/mo) |
| **[MongoDB Atlas](https://www.mongodb.com/pricing)** | Managed Multi-Tenant Database | $57/mo (~₹4,750/mo) for M10 Dedicated Cluster (10 GB storage, RAM allocated) | Credit Card, Monthly post-paid | Immediate | Self-hosted MongoDB on Hetzner / AWS |
| **[Upstash](https://upstash.com/pricing)** | Serverless Redis (Rate limiting & queues) | $10/mo (~₹850/mo) for 100k daily commands | Credit Card, Monthly post-paid | Immediate | [Redis Cloud](https://redis.io/pricing/) ($7/mo) |
| **[Brevo](https://www.brevo.com/pricing/)** | Transactional Email & Auth OTPs (`help@docketra.in`) | Free tier (300/day), then $25/mo (~₹2,100/mo) for 20k emails | Credit Card, Monthly post-paid | Immediate | [AWS SES](https://aws.amazon.com/ses/pricing/) ($0.10 / 1,000 emails) |
| **Razorpay / Sovereign UPI** | Indian Payment Gateway (UPI, Cards, Netbanking) | 0% on Sovereign UPI (Direct to Bank) / 2.0% on PG gateway | T+0 instant / T+2 PG settlement into current account | Immediate for UPI / 3–5 days PG KYC | [Cashfree](https://www.cashfree.com/pricing/) (1.95%) or [Stripe India](https://stripe.com/in) |
| **[Google Cloud Platform](https://cloud.google.com/)** | Google Drive API & OAuth 2.0 | Free tier (Drive API is free within user quota; firm users use own Workspace storage) | Nil for Drive API queries | Verification: 2–3 weeks for brand review | Microsoft Graph API (OneDrive) |
| **[Zoho Books](https://www.zoho.com/in/books/pricing/)** | Indian GST Invoicing & Accounting | ₹749/mo (billed annually ₹8,988/yr) for Standard | UPI / Credit Card, Annual | Immediate | [TallyPrime](https://tallysolutions.com/) |

---

## 3. People & Staffing

### Phase 1: Months 1–3 (0 to 30 Firms — The Bootstrapped Foundation)
During the launch phase, all operations are managed by the 2 founder-operators, supported by a part-time junior onboarding associate:

| Role | Hours / Week | Responsibilities | Compensation | Source / Benchmark |
|---|:---:|---|---|---|
| **Founder 1 (Technical & Product)** | 50 hrs | Core engineering, bug fixes, database scaling, Sentry triage, Google OAuth maintenance. | ₹30,000/mo stipend | CFO numbers ([`founder/cfo.md`](./cfo.md)) |
| **Founder 2 (GTM & Operations)** | 50 hrs | ICAI study circle demos, managing partner sales calls, concierge data imports, support triage. | ₹30,000/mo stipend | CFO numbers ([`founder/cfo.md`](./cfo.md)) |
| **Onboarding Associate (Part-Time)** | 20 hrs | Excel client roster cleaning, template mapping, customer support responses on WhatsApp. | ₹15,000/mo | [Naukri / Glassdoor Indian Jr Ops](https://www.naukri.com/junior-operations-executive-jobs) |

### Phase 2: Months 4–12 (30 to 80+ Firms — Scaling to Break-Even)
As the firm count surpasses the 46-firm operating break-even threshold:
* Hire 1 Full-Time **Customer Success & Compliance Specialist** (₹25,000–₹30,000/mo) with a commerce / semi-qualified CA/CS background who understands statutory forms and can speak the peer language of Managing Partners.
* Founder 1 transitions 100% to product engineering and performance; Founder 2 focuses on ICAI/ICSI study circle partnerships and expansion into tier-1 commercial hubs (Mumbai, Delhi-NCR, Bengaluru, Ahmedabad).

---

## 4. Standard Operating Procedures (SOPs)

### SOP 1: Morning Platform Open & Infrastructure Health (08:30 IST)
1. **API Status:** Log into Render dashboard; confirm API service status is `Live` with CPU utilization < 30% and memory < 60%.
2. **Database Status:** Check MongoDB Atlas dashboard; verify primary replica node health, active connections < 100, and replication lag < 1 second.
3. **Queue Health:** Run Redis health check; verify pending background worker jobs = 0 and dead-letter queue = 0.
4. **Log Review:** Check Sentry for uncaught errors over the last 12 hours. Any error affecting auth or Drive token refresh must be flagged as P0.

### SOP 2: 24-Hour Concierge Client Migration (The Offer Bonus #3)
1. **Receive Source File:** Download the customer's Excel/CSV client roster from secure upload link.
2. **Sanitize Data:**
   * Run client roster validation script against standard schema: Client Name, Entity Type (Pvt Ltd, LLP, Individual), PAN, GSTIN, Contact Person, Email, Phone.
   * Strip special characters, validate 10-digit PAN format (`[A-Z]{5}[0-9]{4}[A-Z]{1}`) and 15-digit GSTIN format.
3. **Staging Review:** Load sanitized records into staging preview; generate a summary PDF showing: Total clients found, duplicates identified, and entity classifications.
4. **Partner Approval:** Email staging summary to Managing Partner for 1-click confirmation.
5. **Production Import:** Execute database insertion with firm ID binding; verify Google Drive root subfolders are provisioned for all clients. Notify partner within 24 hours of submission.

### SOP 3: 1-Click Client Drop Link & Inbound Email Triage Handling
1. **Inbound Attachment Receipt:** When an attachment lands via a 1-click client drop URL (`/upload/:token`), inbound email (`firm@inbox.docketra.in`), or desktop intake dropzone, the worker extracts metadata (sender, filename, mime-type, timestamp).
2. **PAN/GSTIN OCR Match:** The intake engine parses the first page for recognizable tax identifiers (PAN, GSTIN, CIN).
3. **Queue Placement:**
   * *If match found*: File is pre-assigned to the matching client docket with `Pending Maker Review` status.
   * *If no match*: File is routed to the firm's `Unassigned Triage Queue`.
4. **Clerk Notification:** The designated articled assistant receives an in-app badge: *"1 new document awaiting docket classification"*.

### SOP 4: Handling Critical Support Tickets & Drive Re-Authorization Alerts
1. **Severity Classification:**
   * **P0 (Blocker):** Google Drive OAuth token revoked by admin; filing deadline today; partner cannot approve dockets. Response time: < 15 minutes.
   * **P1 (Urgent):** Client import failure; statutory date miscalculation. Response time: < 1 hour.
   * **P2 (Standard):** Feature request; user seat addition; general query. Response time: < 4 hours.
2. **Drive Token Revocation Resolution:**
   * If Google Drive API returns `invalid_grant` (due to password change or 6-month token expiry):
   * Send high-priority SMS and email alert to the firm's `primary_admin`: *"Your Google Drive connection needs a 1-click re-authorization"*.
   * Admin clicks the re-link button; OAuth state exchanges new refresh token; paused document syncs resume automatically without data loss.

### SOP 5: Daily Platform Close & Backup Verification (19:30 IST)
1. **Atlas Snapshot:** Verify that MongoDB Atlas automated snapshot at 19:00 IST completed successfully.
2. **Storage Audit:** Run `node tests/storageAuditOwnershipFirmId.test.js` sanity run on staging to ensure tenant boundary integrity remains unbroken.
3. **Unresolved Ticket Handoff:** Ensure all open customer queries have an assigned owner and an acknowledged response before end of day.

---

## 4.1 Google Drive API Quota & Rate-Limit Management Protocol

Because Docketra operates on Bring Your Own Storage (BYOS) where all dockets and client attachments write directly to the firm's Google Drive, robust management of Google Cloud API quotas is critical to operational uptime:

### 1. Google Drive API Default Quotas (Per Project & User)
* **Queries per 100 seconds per project**: 20,000 queries (~12,000 queries/min).
* **Queries per 100 seconds per user**: 2,000 queries (~1,200 queries/min).
* **Maximum file upload size**: Up to 5 TB per file (handled via resumable chunked upload protocol).
* **Token Lifetime**: Short-lived OAuth access tokens expire every 3,600 seconds (1 hour); long-lived refresh tokens persist indefinitely unless revoked or inactive for 6 months.

### 2. Five Engineering Safeguards Against Quota Exhaustion
1. **Local Metadata Indexing (Zero Drive Directory Scans)**:
   * Docketra NEVER executes recursive `drive.files.list` scans across the firm's Drive during user navigation.
   * All Google Drive folder IDs, file IDs, web view links, and cryptographic checksums are indexed in MongoDB upon creation. Opening a client folder or docket in Docketra consumes **0 Google Drive API calls**.
2. **Exponential Backoff with Full Jitter**:
   * All API calls through [`GoogleDriveProvider.js`](../src/services/storage/providers/GoogleDriveProvider.js) catch HTTP 429 (`Too Many Requests`), HTTP 403 (`rateLimitExceeded`), and HTTP 503 (`Service Unavailable`).
   * Backoff algorithm: $T_{\text{wait}} = \min(32\text{s}, 1\text{s} \times 2^{\text{attempt}}) + \text{random}(0, 500\text{ms})$. Max 5 retry attempts before failing gracefully.
3. **Token Refresh Storm Prevention (Redis Mutual Exclusion)**:
   * When an access token approaches expiry (< 5 minutes remaining), Docketra acquires an atomic Redis distributed lock (`lock:drive_token_refresh:{firmId}`) for 10 seconds.
   * Only one worker process executes the token exchange; all concurrent trainee requests await the cached new access token, preventing multiple simultaneous OAuth refresh requests.
4. **Off-Peak Bulk Export Scheduling**:
   * End-of-quarter archive packaging and full firm backups are throttled to run via BullMQ queues between 22:00 and 06:00 IST, reserving 90%+ of API quota headroom for daytime filing operations.
5. **Proactive Peak-Season Quota Upgrades (July & October)**:
   * Filing crunch happens during July (ITR individuals) and October (ROC/Tax Audits).
   * 45 days prior to peak seasons (May 15 and August 15), Docketra operations submits a formal Google Cloud Console quota increase request (increasing project queries from 20,000 to 50,000 per 100 seconds) backed by projected firm counts.

---

## 5. Tools Stack & Published Costs

| Tool | Purpose | Published Monthly Cost | Why This Tool |
|---|---|---:|---|
| **Razorpay Standard** | Subscriptions & Indian Payment Gateway | 2.0% per transaction (~₹30 on ₹1,499) | Defacto standard in India; supports UPI auto-pay, netbanking for all 50+ PSU/private banks, and corporate credit cards. |
| **Render Web Service** | API server execution | $25.00 (~₹2,100) | Zero-DevOps Git push deployments with built-in SSL, DDoS protection, and health checks. |
| **MongoDB Atlas (M10)** | Multi-tenant database | $57.00 (~₹4,750) | Automated backups, encrypted storage at rest, SOC-2 compliant, VPC peering. |
| **Upstash Redis** | Caching, session rate limits | $10.00 (~₹850) | True serverless billing, REST API compatibility, zero cluster management. |
| **Brevo** | Transactional emails & OTPs (`help@docketra.in`) | $25.00 (~₹2,100) | Exceptional deliverability to corporate Gmail/Workspace inboxes; dedicated sender branding. |
| **Sentry Developer** | Error monitoring & performance | $26.00 (~₹2,200) | Instant stack-trace capture for frontend React and backend Express exceptions. |
| **Cloudflare (Free)** | DNS, SSL, WAF, Edge Caching | ₹0.00 | Free enterprise-grade DDoS mitigation, HTTP/3, and fast DNS propagation for `docketra.in`. |
| **Google Workspace (2 Seats)** | Admin email & internal ops | ₹500 (~₹250/user/mo) | Professional `@docketra.in` email identity for customer communications. |
| **Zoho Books** | GST billing & invoicing | ₹749.00 | Automated Indian GST e-invoicing compliance and annual B2B return reconciliations. |
| **Total Monthly Tooling** | — | **~₹13,500 / month** | **Lean, professional, highly resilient foundation.** |

---

## 6. Licences, Permits, Taxes & Insurance Checklist (India)

*Notice: This checklist summarizes standard compliance for Indian B2B SaaS entities. It is not formal legal advice.*

| Requirement | Authority / Portal | Status / Action | Verification Link |
|---|---|---|---|
| **Private Limited Company Incorporation** | Ministry of Corporate Affairs (MCA) | File SPICe+ (INC-32) with RUN name approval (`Docketra Technologies Pvt Ltd`). | [mca.gov.in](https://www.mca.gov.in) |
| **PAN & TAN Allotment** | Income Tax Department | Auto-allotted with Certificate of Incorporation via SPICe+. | [incometax.gov.in](https://www.incometax.gov.in) |
| **GST Registration** | CBIC / Goods & Services Tax Network | Mandatory for inter-state supply of SaaS services. SAC Code: **998313** (Information technology software services) @ 18% GST. | [gst.gov.in](https://www.gst.gov.in) |
| **Professional Tax (PT)** | State Commercial Tax Department | Register employer PT within 30 days of hiring staff in the state of incorporation. | State Commercial Tax Portals |
| **Shop & Establishment Registration** | State Labour Department | Obtain online within 30 days of commercial operations commencement. | State Labour Portals |
| **Digital Personal Data Protection (DPDP) Act 2023** | Data Protection Board of India | Publish Data Processing Agreement (DPA) affirming that Docketra acts strictly as a **Data Processor** while the firm remains the **Data Fiduciary**. Documents reside in firm's BYOS storage. | [meity.gov.in](https://www.meity.gov.in) |
| **Technology E&O & Cyber Risk Insurance** | HDFC ERGO / ICICI Lombard | ₹1 Crore Tech Errors & Omissions (E&O) and Cyber Liability policy to indemnify against data breach claims. Cost: ~₹25,000–₹35,000/year. | Insurer Portals |

---

## 7. Operational Risk Register (Top 10 Risks)

| # | Risk Event | Probability (1-5) | Severity (1-5) | Risk Score (P × S) | Mitigation & Emergency Response Plan |
|---|---|:---:|:---:|:---:|---|
| **1** | **Google Drive OAuth Token Revocation** | 3 | 4 | **12** | Google tokens can expire if the firm admin changes passwords or after 6 months of inactivity. **Plan**: System monitors refresh token failures, fails open gracefully with clear in-app notification to `primary_admin`, and provides a 1-click re-link workflow without data loss. |
| **2** | **Peak Filing Season Server Crunch (July & October)** | 3 | 4 | **12** | Heavy traffic during ITR and ROC filing cutoffs. **Plan**: Render autoscale configured to spin up 2 additional instances when CPU exceeds 70%. Redis caching prevents database query spikes. |
| **3** | **Article Clerk High Churn & Retraining Friction** | 4 | 3 | **12** | Clerks rotate every 2 years; new trainees arrive with zero context. **Plan**: Turnkey Statutory Blueprints provide step-by-step checklist templates; simple Maker-Checker UI requires zero onboarding training. |
| **4** | **Payment Gateway KYC Hold on Payouts** | 2 | 4 | **8** | Razorpay holds settlements pending enhanced merchant verification. **Plan**: Complete full video KYC and document submission during incorporation; maintain backup merchant account on Cashfree. |
| **5** | **Transactional Email Spam Filtering** | 2 | 4 | **8** | Auth OTPs or docket notifications land in client spam folders. **Plan**: Maintain strict SPF, DKIM, and DMARC DNS records via Cloudflare; monitor Resend bounce rates daily (<0.5% threshold). |
| **6** | **Accidental Folder Deletion in Google Drive by Clerk** | 2 | 4 | **8** | Clerk accidentally deletes a synced client folder inside Drive. **Plan**: Docketra maintains an independent metadata index in MongoDB. Files can be re-indexed or re-linked, and Google Drive's 30-day Trash allows 1-click restore. |
| **7** | **Slow Pioneer Cohort Conversion (Cash Runway Squeeze)** | 3 | 3 | **9** | Paid firm ramp takes longer than the 5-month plan. **Plan**: Founders operate on lean ₹30k stipends; fixed monthly overhead is kept strictly under ₹85,000; break-even is achieved at just 46 firms. |
| **8** | **Government Portal Outages (MCA v3 / Income Tax Portal)** | 4 | 2 | **8** | MCA v3 portal glitches prevent filings, causing practitioner panic. **Plan**: Docketra's internal statutory calendar flags known government portal downtimes and logs filing attempts for SQC-1 audit trail defense. |
| **9** | **Key Founder Incapacitation / Illness** | 2 | 4 | **8** | One of the two technical/ops founders is unavailable for 2 weeks. **Plan**: Comprehensive SOPs documented in this manual; GitHub CI/CD automated deployment; 1Password shared vault for all production credentials. |
| **10** | **Competitor Price War (Jamku / QwikCA Discounts)** | 3 | 2 | **6** | Competitors drop sticker prices. **Plan**: Stand firm on Sovereign BYOS and Zero Setup Fees. Jamku charges ₹3k–₹15k hidden setup fees; Docketra’s sovereign custody cannot be matched by centralized databases. |

---

## 8. Summary of Open Operational Questions

1. **Merchant Current Account Bank Selection**: Recommendation to open current account with ICICI Bank or HDFC Bank for fastest integration with Razorpay auto-settlements.
2. **Cyber Insurance Policy Inception Date**: Bind the ₹1 Crore Tech E&O policy prior to onboarding Firm #10 to protect against third-party liability.
