# CFO Sources & Cost Verification: Docketra

Every cost line in [`founder/numbers.json`](./numbers.json) traces to public supplier price lists, cloud infrastructure benchmarks, or statutory filings:

---

## 1. Variable Costs (Per Paying Firm-Month)

| Item | Cost | Source & Calculation |
|---|---:|---|
| **Database & Compute Overhead** | ₹95.00 | MongoDB Atlas M10 cluster (~$57/mo) + Render Web Service compute allocated across multi-tenant queries. BYOS eliminates document storage, leaving only JSON metadata. |
| **Transactional Email & Auth** | ₹25.00 | [Resend](https://resend.com/pricing) (3,000 emails/mo free, then $20 for 50,000) or [AWS SES](https://aws.amazon.com/ses/pricing/) ($0.10 per 1,000 emails). Budget covers OTPs, docket assignments, and partner review notices (~250 emails/firm/mo). |
| **Payment Gateway Processing** | ₹30.00 | [Razorpay Indian Standard Pricing](https://razorpay.com/pricing/): 2.0% on domestic credit cards/UPI/Netbanking on a ₹1,499 transaction = ₹29.98. |
| **File Storage Cost** | **₹0.00** | **Sovereign BYOS Architecture**: 100% of PDFs, balance sheets, and tax filings live inside the firm's own Google Workspace / Google Drive. Docketra pays zero marginal storage or bandwidth fees. |

---

## 2. Fixed Monthly Overhead

| Item | Cost | Source & Calculation |
|---|---:|---|
| **Base Cloud Infrastructure** | ₹20,000.00 | Render API servers (Standard $25/mo), MongoDB Atlas Replica Set ($57/mo), Redis instance (Upstash $10/mo), Cloudflare DNS/WAF (Free tier), GCP Cloud Run async worker jobs ($20/mo). Total: ~$115–$130/mo (~₹18,000–₹20,000/mo). |
| **Developer Tooling & Domains** | ₹5,000.00 | GitHub Team ($4/user/mo), Google Workspace admin accounts (2 seats @ ₹250/mo), Sentry error monitoring ($26/mo), domain registration amortized. |
| **Core Operations & Founder Lean Stipend** | ₹60,000.00 | Essential monthly living stipend and operational budget for bootstrapped founders during initial pilot rollouts. |
| **Total Fixed Monthly Overhead** | **₹85,000.00** | **Baseline burn rate** required to operate Docketra. |

---

## 3. One-Off Startup Spend

| Item | Cost | Source & Calculation |
|---|---:|---|
| **Legal Incorporation & Trademark** | ₹15,000.00 | MCA SPICe+ Pvt Ltd or LLP incorporation fees, government stamp duties, and Indian Trademark Registry filing under Class 9 & Class 42 via [IP India](https://ipindiaservices.gov.in). |
| **Brand Identity & Web Production** | ₹15,000.00 | Domain acquisitions (`docketra.in`, `docketra.co.in`), production UI assets, Cal Sans / typography licenses, SSL certificates, and initial collateral. |
| **Pilot Launch & Study Circle Demos** | ₹20,000.00 | Tea/snack sponsorships and demonstration booth setups across 3 regional ICAI / ICSI study circle seminars in Mumbai / Delhi. |
| **Total Startup Investment** | **₹50,000.00** | |

---

## 4. Break-Even & Sensitivity Benchmarks

* **At ₹1,499/mo (Starter Annual)**: Contribution is **₹1,349/firm-month (90%)**. Break-even is **63 active paying firms**.
* **At ₹1,999/mo (Starter Monthly / Blended with Pro)**: Contribution is **₹1,849/firm-month (92%)**. Break-even is **46 active paying firms**.
* **At ₹1,082/mo (Pioneer Cohort ₹12,990/yr)**: Contribution is **₹932/firm-month (86%)**. Break-even is **91 active paying firms**.
