# Docketra: Board Brief (Updated)

## 1. The Business Idea & Customer
Docketra (`docketra.in`) is a sovereign practice operations platform purpose-built for the 120,000+ practicing Chartered Accountant (CA), Company Secretary (CS), and corporate tax compliance firms in India. Primary initial wedge: 2-to-6 partner boutique practices (50–200 active corporate retainers) running Google Workspace.

## 2. The Core Problem
- **WhatsApp Chaos**: Small-business clients refuse complex client portals and habitually dump unorganized PDFs, bills, and PAN cards into WhatsApp threads.
- **Article Clerk (Trainee) Churn**: Articled assistants rotate every two years, causing continuous retraining overhead and errors on statutory filings.
- **Peer-Review Vulnerability**: ICAI Standard on Quality Control (SQC-1) and NFRA require strict, documented maker-checker review trails. Currently, partners sign off informally on Excel sheets.
- **Data Custody Paranoia**: CAs fear multi-tenant cloud tools (like Jamku) that store sensitive client financial data and returns in proprietary third-party databases.
- **Endpoint Leakage**: Article clerks frequently download raw client financials onto personal laptops and USB drives without security controls.

## 3. Product Architecture & Proprietary Mechanisms
- **Zero-Custody Bring-Your-Own-Storage (BYOS)**: Client documents remain permanently inside the firm's own Google Drive under Google's restricted `drive.file` OAuth scope. Docketra only reads files it creates; live in-app cryptographic audit confirms zero access to existing private files. Root manifest telemetry automatically detects, alerts, and restores accidentally moved or trashed folders in 1 click.
- **Trainee Laptop Shield**: Firm-level security control that blocks junior clerks and article trainees from downloading raw client files or bank statements to personal devices (secure in-app document preview only).
- **Native Maker-Checker Execution**: Junior clerks prepare work; senior partners review, query, and sign off with immutable, tamper-evident timestamps compliant with ICAI SQC-1.
- **Turnkey Statutory Checklists (15+ Blueprints)**: Pre-loaded checklists covering MCA Annual Filings (AOC-4, MGT-7), ROC Director KYC, GSTR-3B Reconciliation, and Tax Audit Form 3CD (all 44 clauses).
- **WhatsApp Ingestion Bridge**: 1-click mobile upload links (`/upload/:token`) and direct assistant forwarding/dropzone—clients never need to register, remember passwords, or download an app. (Meta Cloud API automated webhook also implemented).

## 4. Packaging & Pricing Ladder (Restructured)
- **Proof of Sovereign Isolation Sandbox**: ₹0 forever, capped at 2 seats, 5 active clients, and 15 monthly dockets. Full feature parity (Google Drive BYOS, Trainee Shield, Maker-Checker QC). Closes the free-tier cannibalization loop when practices onboard client #6.
- **Starter Tier (Pioneer 30)**: ₹1,499/month billed annually (₹17,990/year) or ₹1,999/month monthly, for up to 5 seats and 50 clients with unlimited dockets. (Launch offer: ₹12,990/year locked for life for the first 30 founding firms with zero setup fees).
- **Growth Tier**: ₹1,832/month billed annually (₹21,990/year flat) or ₹2,499/month monthly, for up to 12 seats, 150 clients, and shared department queues (Tax, ROC, Audit), with +₹1,200/seat/year add-ons. Bridges the 4.6x cliff between Starter and Pro.
- **Pro Tier**: ₹4,999/month billed annually (₹59,990/year), up to 25 seats, unlimited clients, multi-branch, and DSC routing.

## 5. Financials & Unit Economics
- **Price**: ₹1,499 / firm-month (Starter annual benchmark).
- **Variable Cost**: ~₹150 / firm-month (compute, email, SMS, payment gateway; zero marginal storage cost due to BYOS).
- **Gross Contribution Margin**: 90% (earns ₹1,349 on every ₹1,499 firm-month).
- **Fixed Monthly Burn**: ₹85,000 / month (₹35k infrastructure/monitoring/APIs + ₹50k founder stipends).
- **Operating Break-Even**: 63 active firms (3 firm-months a day against a 20/day capacity).
- **Year 1 Operating Profit**: ₹1,29,348 (scaling from 30 to 99 active firms; ending ARR ₹32.3 Lakhs).
- **Initial Startup Spend**: ₹50,000.
- **Maximum Cumulative Cash Needed**: ₹1,55,274 (peak deficit at Month 4; cash-flow positive Month 5; capital payback Month 11).

## 6. Real-World & Panel Evidence
- **Van Westendorp Price Sensitivity**: Acceptable annual range for 100 simulated CA/CS buyers is ₹5,892 to ₹24,002. Docketra's Pioneer (₹12,990), Starter (₹17,990), and Growth (₹21,990) sit squarely inside this range.
- **Consumer Panel (Seed 90977, 100 personas)**: 16 buys · 84 passes (16% buy rate).
  - Tech-forward practitioners: 58% conversion (7 of 12).
  - Mid-sized firms (6–20 staff): 25% conversion (5 of 20).
  - Main pass reasons: Google Drive confidentiality paranoia (28), WhatsApp habit inertia (27), Jamku price comparison (17).
- **Competitors**: Jamku (₹6,500/yr + ₹3,000–₹15,000 setup fee + storage add-ons), QwikCA (₹7,200/yr per-user), Zoho Practice (₹35,400/yr). Over 80% of firms rely on WhatsApp + Excel (the free default status quo).

## 7. Go-To-Market & Launch Plan
- **Primary Channel**: 20-minute live demonstration ("SQC-1 Defensibility & Digital Audit Trails on Google Drive") at local ICAI and ICSI branch study circles.
- **Pre-Launch Reality Check**: Secure 5 paid Pioneer deposits (₹2,500 refundable deposit locking ₹12,990/yr for life) from 25 warm contacts in 14 days before spending capital.
- **Assisted Onboarding**: 24-hour concierge client Excel migration.
