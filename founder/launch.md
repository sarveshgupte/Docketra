# Launch Plan & Opening Countdown: Docketra

This launch plan outlines the exact sequence to take Docketra from pre-launch validation to commercial launch day and the first 30 operating days.

Every deadline, budget, and operational handoff traces to [`founder/ops.md`](./ops.md), [`founder/marketing.md`](./marketing.md), [`founder/numbers.json`](./numbers.json), and [`founder/offer.md`](./offer.md).

---

## 1. Test Before You Spend (The Pre-Launch Reality Check)

Before spending the ₹50,000 startup capital in [`founder/numbers.json`](./numbers.json) (incorporation, brand production, seminar sponsorships), run a low-cost, real-money commitment test with practicing partners.

### The Test Design: The "Founding 10" Pre-Order Deposit
* **What**: Offer a limited **Founding Firm Pre-Order** to 25 warm CA/CS contacts in the founders' professional network.
* **The Deal**: Lock in the Pioneer Annual rate of **₹12,990 / year for life** by placing a fully refundable **₹2,500 commitment deposit**. In exchange, they receive:
  1. Priority onboarding in Cohort #01.
  2. Free 24-hour concierge client list migration from their current Excel roster.
  3. 60-day extended money-back trial (double the standard 30 days).
* **The Success Line (Pre-Launch Gate)**:
  * **Target**: **5 paid deposits (20% conversion) within 14 days**.
  * **Comparison to Panel**: In [`founder/panel/results.md`](./panel/results.md), the panel scored 15% overall buy rate and 50% in tech-forward and frugal segments. Achieving 5 paid deposits confirms real-world willingness to pay matches the simulated panel.
  * **Failsafe**: If fewer than 3 firms put down money, do not proceed with the launch budget. Return to [`founder/offer.md`](./offer.md) and [`founder/pricing.md`](./pricing.md) to diagnose whether data custody fears or price resistance are still blocking commitment.

---

## 2. The 30-Day Countdown to Launch Day

**Assumed Launch Date**: T-Zero = 30 days from project kickoff.

```
Critical Path: [Legal & Merchant KYC] ──> [Google OAuth App Verification] ──> [Pilot Soft Open] ──> [Public Launch Day]
```

### Week 1 (Days -30 to -24): Legal, Banking & Production Foundations
* [ ] **Legal Incorporation**: Submit SPICe+ (INC-32) on MCA portal for *Docketra Technologies Pvt Ltd*. *(Owner: Founder 2 | Deadline: Day -26)* **[CRITICAL PATH]**
* [ ] **Google Cloud App Review**: Submit Docketra's OAuth verification request for restricted `drive.file` scope in Google Cloud Console. *(Owner: Founder 1 | Deadline: Day -28)* **[CRITICAL PATH]**
* [ ] **Domain & DNS Hardening**: Configure Cloudflare DNS, SSL/TLS, and strict SPF/DKIM/DMARC records for `docketra.in`. *(Owner: Founder 1 | Deadline: Day -25)*
* [ ] **Pre-Launch Commitment Test**: Pitch the "Founding 10" pre-order to 25 warm CA/CS contacts. *(Owner: Founder 2 | Deadline: Day -24)*

### Week 2 (Days -23 to -17): Banking, Infrastructure & Security Whitepaper
* [ ] **Bank Current Account & Razorpay KYC**: Open current account (ICICI/HDFC); submit business documents to Razorpay for merchant activation. *(Owner: Founder 2 | Deadline: Day -18)* **[CRITICAL PATH]**
* [ ] **Production Infrastructure**: Deploy Render Web Service, provision MongoDB Atlas M10 dedicated cluster, configure Upstash Redis. *(Owner: Founder 1 | Deadline: Day -19)*
* [ ] **Security Whitepaper Production**: Format and print the *"Zero-Access Sovereign Drive Custody Whitepaper"* for distribution to senior partners. *(Owner: Founder 2 | Deadline: Day -17)*
* [ ] **Review Pre-Launch Gate**: Confirm at least 5 deposits secured. *(Owners: Founders 1 & 2 | Deadline: Day -17)*

### Week 3 (Days -16 to -10): Concierge Tooling & Study Circle Booking
* [ ] **Concierge Migration Engine**: Finalize and test the automated Excel-to-MongoDB client roster import scripts. *(Owner: Founder 1 | Deadline: Day -12)*
* [ ] **Statutory Blueprints Verification**: Verify pre-loaded templates for MCA Annual Filings, DIR-3 KYC, GST, and Tax Audit 3CD. *(Owner: Founder 1 | Deadline: Day -13)*
* [ ] **ICAI Study Circle Bookings**: Finalize speaking slots/sponsorships with convenors of 2 Mumbai study circles (Nariman Point & Andheri) and 2 Delhi study circles. *(Owner: Founder 2 | Deadline: Day -10)* **[CRITICAL PATH]**
* [ ] **Launch Teaser Content**: Begin Day -14 marketing sequence on LinkedIn per [`founder/marketing.md`](./marketing.md). *(Owner: Founder 2 | Deadline: Day -14)*

### Week 4 (Days -09 to -01): The Soft Open (Friends & Family Beta)
* [ ] **Soft Open Onboarding**: Onboard the 5 deposit-paying founding firms onto the production platform. Run live concierge imports for their client rosters. *(Owners: Founders 1 & 2 | Deadline: Day -07)*
* [ ] **End-to-End Filing Dry Run**: Test complete maker-checker workflow: clerk generates 1-click client drop link -> client uploads document -> partner reviews on mobile -> approves. *(Owner: Founder 1 | Deadline: Day -05)*
* [ ] **Payment Webhook Verification**: Execute real ₹1 test transactions through Razorpay live environment; verify automated GST invoice generation. *(Owner: Founder 1 | Deadline: Day -04)*
* [ ] **Launch Rehearsal**: Dry run of launch-day webinar and seminar presentation deck. *(Owner: Founder 2 | Deadline: Day -02)*

---

## 3. Launch Day Run Sheet (Day 00)

**Target Launch Date**: Thursday (Optimal weekday for Indian professional practices; avoids Monday crunch and weekend drop-off).

| Time (IST) | Channel / Area | Action | Owner | Contigency Plan (If Error Occurs) |
|---|---|---|---|---|
| **08:00** | Infrastructure | Final sanity check: verify Render API, Atlas replica health, Redis queues, and Resend delivery status. | Founder 1 | If API fails, check Render deployment rollback log. |
| **09:00** | Website & Portal | Switch `docketra.in` from pre-launch teaser to live application. Enable public sign-up and Pioneer 30 pricing. | Founder 1 | Verify DNS propagation via Cloudflare edge. |
| **10:00** | LinkedIn & Community | Publish official Launch Announcement post; tag founding pilot partners and industry contributors. | Founder 2 | Monitor post comments; reply to inquiries within 5 mins. |
| **11:00** | Email Outreach | Send personal Pioneer Cohort activation links to 50 waitlisted managing partners. | Founder 2 | Resend via alternate transactional provider if bounces occur. |
| **14:00** | Live Demo Webinar | Host 30-minute interactive Zoom demo: *"How Boutique CAs Run Audit-Proof Practices on Google Drive"*. | Both | Record session; automatically email replay to non-attendees. |
| **16:30** | Study Circle Seminar | Present 20-minute physical session at ICAI Mumbai Study Circle: *"SQC-1 Defensibility & Digital Audit Trails"*. | Founder 2 | Distribute printed Zero-Access Security Whitepapers. |
| **18:30** | Onboarding Triage | Review day-one registrations; initiate 24-hr concierge imports for new firms who uploaded client lists. | Both | Process imports in order of receipt. |
| **21:00** | Day-One Close | Verify Razorpay settlements, log day-one metrics, and review customer feedback logs. | Both | Send founder thank-you email to all registered firms. |

---

## 4. The First 30 Days (Operating Review Cadence)

### Weekly Metrics to Track (Against CFO Targets)

| Metric | Target (Week 1) | Target (Week 2) | Target (Week 3) | Target (Week 4) | Source |
|---|:---:|:---:|:---:|:---:|---|
| **Total Sign-ups (Free Sandbox)** | 25 firms | 55 firms | 90 firms | 130 firms | Database |
| **Pioneer Paid Conversions (₹12,990)** | 6 firms | 14 firms | 22 firms | **30 firms (Cap reached)** | Razorpay |
| **Active Dockets Created / Firm** | > 5 | > 10 | > 15 | > 20 | Telemetry |
| **Concierge Migrations Completed** | 6 | 14 | 22 | 30 | Operations log |
| **Support Tickets Response Time** | < 15 mins | < 15 mins | < 20 mins | < 20 mins | Support inbox |

---

### Milestone Reviews

#### Day 07 Review: The Onboarding Health Check
* **Questions to Answer**:
  1. Did new firm admins connect Google Drive on their first session without abandoning the OAuth consent screen?
  2. Did clients successfully drop files via the 1-click upload link into dockets?
* **Trigger for Change**: If > 30% of sign-ups abandon at the Google Drive permission step, publish an in-app 15-second visual tooltip explaining that Docketra strictly only reads the folder it created.

#### Day 14 Review: The Free-to-Paid Conversion Check
* **Questions to Answer**:
  1. Are firms hitting the 5-client Free Sandbox threshold and initiating upgrades to Starter?
  2. Is the Pioneer 30 scarcity creating urgency in sales conversations?
* **Trigger for Change**: If firms are active but not upgrading, review whether the 5-client limit is being enforced correctly across all workspace routes.

#### Day 30 Review: The Unit Economics & Breakeven Trajectory
* **Questions to Answer**:
  1. Did we achieve the 30 Pioneer Cohort target (generating ₹3,89,700 in upfront annual cash collections)?
  2. Is the fixed monthly burn rate holding within the planned ₹85,000 threshold?
  3. Are any firms requesting refunds under the 30-Day Zero-Risk Guarantee?
* **Next Action**: Transition the Starter tier from the promotional ₹12,990 Pioneer rate to the standard commercial rate of **₹1,499 / month billed annually (₹17,990/year)** and **₹1,999 / month billed monthly**.
