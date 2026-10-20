# Pricing Strategy & Tier Restructuring: Docketra

This strategy is derived from the consumer panel's Van Westendorp price sensitivity curve ([`founder/pricing-curve.md`](./pricing-curve.md)), competitor benchmarks ([`founder/competitors.md`](./competitors.md)), and Docketra's unit economics ([`founder/numbers.json`](./numbers.json)).

---

## 1. The Core Price & Economic Rationale

### Van Westendorp Benchmarks (From 20 Simulated CA/CS Buyers)
- **Point of Marginal Cheapness (PMC)**: ₹1,021 / month (below this, practitioners suspect data insecurity or shoddy engineering).
- **Optimal Price Point (OPP)**: **₹1,527 / month** (the price with minimum resistance either way).
- **Indifference Price Point (IPP)**: **₹2,467 / month** (where equal numbers call it a bargain vs. expensive).
- **Point of Marginal Expensiveness (PME)**: ₹4,966 / month (upper resistance ceiling).

### The Decision:
* **Starter Annual (The Core Driver)**: **₹1,499 / month** (₹17,990 / year billed annually)
  *Lands almost precisely on the panel's Optimal Price Point (OPP = ₹1,527/mo)*. It provides the path of least resistance for conservative partnership firms.
* **Starter Monthly (Flexibility Tier)**: **₹1,999 / month** (billed monthly)
  *Positioned between OPP (₹1,527) and IPP (₹2,467)*, rewarding annual commitments with a 25% discount.
* **Economics**: At ₹1,499–₹1,999/month, Docketra maintains a **92% contribution margin** (variable compute/email/gateway cost is only ~₹160/firm-month). Fixed costs break even at just **46 paying firms**.

---

## 2. The Restructured Price Ladder (Capping the Free Tier)

The consumer panel proved that an unrestricted 2-user free tier causes **100% commercial cannibalization** for solo practitioners. We restructure the ladder by introducing **active client and docket volume caps**, while maintaining 100% feature access.

| Tier | Target Firm | Team Size | Active Clients & Dockets | Price (Monthly / Annual) | Core Inclusions |
|---|---|---|---|---|---|
| **Free Sandbox** *(Proof of Sovereign Isolation Pilot)* | Solo CAs, new practitioners, practice evaluation | **Up to 2 users** | **Capped at 5 Active Clients** & **15 Dockets / month** | **₹0 forever** | Full feature parity: 1-click Google Drive BYOS, live cryptographic boundary audit, Trainee Laptop Shield, Maker-Checker QC, statutory calendar, audit log. 1-click friction-free upgrade. |
| **Starter** *(Boutique)* | 2 to 5 person partnership practices | **Up to 5 users** | **Up to 50 Active Clients** & **Unlimited Dockets** | **₹1,999 / mo** (Monthly)<br>**₹1,499 / mo** (₹17,990/yr Annual)<br>*(Promo: ₹12,990/yr Pioneer)* | Full feature access, unlimited BYOS storage in firm's Drive, zero setup fee, 1-click client drop links, email support. |
| **Growth** *(Mid-Sized / Expanding)* | 6 to 12 person firms, rotating article clerks | **Up to 12 users** *(+₹1,200/seat/yr)* | **Up to 150 Active Clients** & **Unlimited Dockets** | **₹2,499 / mo** (Monthly)<br>**₹1,832 / mo** (₹21,990/yr Annual) | Everything in Starter + Shared department queues (ROC, Tax, SEBI), trainee maker-checker workflows, bulk dropzone, Drive sync recovery. |
| **Pro** *(Growth / Multi-Partner)* | 15+ person firms, multi-branch practices | **Up to 25 users** | **Unlimited Clients** & **Unlimited Dockets** | **₹5,999 / mo** (Monthly)<br>**₹4,999 / mo** (₹59,990/yr Annual) | Everything in Growth + Multi-partner DSC sign-off routing workflows, custom roles, priority SLA & dedicated migration engineer. |

### Why the Growth Tier Bridges the 4.6x Mid-Sized Practice Cliff:
1. **Eliminates the Cliff**: Previously, firms with 6 to 12 staff had to jump from ₹12,990/yr directly to ₹59,990/yr (a 4.6x jump), causing 100% of mid-sized practices to pass in the consumer panel (P008, P016).
2. **Matches Willingness to Pay**: At **₹21,990/year flat** (~₹1,832/mo), it lands directly within the ₹20,000–₹25,000 annual budget reported by mid-sized managing partners.
3. **Economies of Scale**: Effective cost per seat drops to **₹1,832 / seat / year** (compared to ₹2,598 on Starter), rewarding growing practices while maintaining an **86.4% gross contribution margin** for Docketra.
4. **Flexible Expansion**: Teams needing 13 or 14 seats can add individual seats at ₹1,200/seat/year (+₹149/mo) without an immediate leap to enterprise Pro.

### Why This Free-Tier Cap Works:
1. **Frictionless Evaluation**: A firm can sign up in 60 seconds, connect their Google Drive, and run 5 real client matters without entering credit card details.
2. **Closes the Cannibalization Loop**: Active Indian CA/CS practices handle between 30 and 150 client retainers. As soon as they onboard client #6 or docket #16, they hit an operational cap:
   > *"You have reached the 5-client limit on the Proof of Sovereign Isolation Pilot. Upgrade to Pioneer 30 or Growth Tier to unlock up to 50–150 client retainers and unlimited dockets."*
3. **No Artificial Feature Degradation**: The free tier retains Maker-Checker QC and BYOS. The partner experiences the full dream outcome, making the upgrade decision purely a function of firm practice volume.

---

## 3. The Opening Offer (Founder Pioneer Cohort)

To overcome the inertia of existing WhatsApp/Excel routines and build the first 50 reference firms:

* **The Offer**: *"The First 50 Pioneer CA & CS Practices"*
* **The Deal**: Lock in the **Starter Annual plan for ₹12,990 / year** (~₹1,082/mo) for life (saves ₹5,000/yr).
* **Stack Bonuses (Zero Marginal Cost)**:
  1. *Free Concierge Client Migration*: Send us your messy Excel client list; our team formats and imports it within 24 hours.
  2. *Turnkey Statutory Workflow Blueprints*: Pre-loaded maker-checker checklists for MCA Annual Returns, ROC Director KYC, GSTR-3B Reconciliation, and Tax Audits (Form 3CD).
  3. *Restricted Google Drive Security Certificate*: Official compliance whitepaper certifying restricted `drive.file` OAuth scope for partner peace of mind.
* **Risk Reversal**: **30-Day Unconditional Money-Back Guarantee**. If Docketra does not save your firm at least 10 hours a week on client follow-up, get a 100% refund—and keep all your files safely in your own Google Drive.
* **Urgency**: Strictly limited to the first 50 verified firms or until the end of the next ICAI seminar cycle.

---

## 4. What to Test with Real Buyers (A/B Testing Plan)

1. **Test 1: Client Cap Threshold on Free Tier**:
   - *Variant A*: 5 Active Clients & 15 Dockets (Strict conversion trigger).
   - *Variant B*: 10 Active Clients & 30 Dockets (Higher organic adoption, slightly slower conversion).
   - *Metric*: 30-day conversion rate from Free to Starter.
2. **Test 2: Annual Pricing Presentation vs. Jamku**:
   - *Variant A*: Highlight monthly price: *"₹1,499/mo (billed annually)"*.
   - *Variant B*: Highlight total ownership savings vs. legacy tools: *"₹17,990/yr — Zero setup fees, unlimited Google Drive storage included (Save ₹12,000+ vs. Jamku + add-ons)"*.

---

## 5. Direct Answers to Panel Price Objections

### The Cardinal Rule on Competitors:
**Do not engage in a race to the bottom against Jamku on price.**
Docketra will never discount to ₹6,500 to match cheap task-management tools. Our pricing is grounded in three enterprise pillars:
1. **Operational Sovereignty**: Permanent custody of all files in firm-owned Google Drive (BYOS). Zero vendor hostage.
2. **Peer-Review Defensibility**: ICAI / ICSI SQC-1 audit readiness with maker-checker approvals and 44-clause Tax Audit 3CD blueprints.
3. **Zero-Leakage Compliance**: Google restricted `drive.file` OAuth isolation and Trainee Laptop Shield endpoint defense.

| Panel Objection | The Strategic Reframe (in simple Indian English) |
|---|---|
| **"Why should I pay when free has all features?"** *(P005, P009)* | *"The Free Sandbox is strictly limited to 5 clients for micro-evaluation. Commercial practices managing dozens of corporate retainers upgrade to Starter for less than the fee of a single GST filing retainer."* |
| **"Jamku is only ₹6,500/year, why should I pay more for Docketra?"** *(P013, P016)* | *"We do not compete with Jamku on price because Jamku is just a basic to-do list where your client files sit on someone else's shared server. Docketra is your firm's operational shield. You get: (1) **Operational Sovereignty**—100% of your documents remain in your own firm's Google Drive permanently, with zero vendor hostage; (2) **Peer-Review Defensibility**—complete ICAI SQC-1 maker-checker audit trails and pre-loaded 44-clause Tax Audit 3CD & MCA checklists so trainees don't miss compliance clauses; and (3) **Zero-Leakage Compliance**—Trainee Laptop Shield blocks articles from downloading raw client files to personal laptops, while Google's restricted `drive.file` scope guarantees Docketra cannot read your private returns. One single client data leak or peer-review penalty costs lakhs. Saving ₹500 a month on cheap software is simply not worth risking your firm's professional license."* |
| **"Excel and WhatsApp are free."** *(P003, P007)* | *"Excel is free until a clerk misses an MCA filing deadline and triggers a ₹10,000 penalty, or an assistant leaves with confidential client PAN cards on their personal phone. Docketra keeps files in your Drive and guarantees maker-checker sign-off on every job."* |

---

## 6. Next Step

With the price ladder, free-tier volume caps, and unit economics aligned:
* Run **`/founder-offer`** to package the complete value stack (the WhatsApp ingestion bridge, Google Drive security certificate, and turnkey compliance templates) and test whether the consumer panel flips from pass to buy!
