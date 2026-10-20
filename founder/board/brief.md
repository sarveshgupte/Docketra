# Docketra: Board Brief

## The Business Idea

Docketra is a B2B firm operations platform that unifies client intake (CMS), relationship pipeline (CRM), and execution/QC (Task Manager / Dockets) into a sovereign, audit-ready workspace with Bring Your Own Storage (BYOS).

- **Target Market**: Chartered Accountants (CA), Company Secretaries (CS), Tax Consultants, Corporate Secretarial teams, and boutique legal/compliance practices in India.
- **Problem Solved**: Small and mid-size compliance/accounting firms currently run on disconnected, fragile tools: WhatsApp for client communication, spreadsheets for tracking deadlines, email attachments for sensitive PAN/GST/ROC documents, and generic task managers (Trello, Asana, Monday) that lack maker-checker QC, firm sovereignty, or regulatory audit trails.
- **Core Architecture & Moat**:
  - **Sovereign BYOS (Bring Your Own Storage)**: Files are stored directly in the firm's own cloud storage (Google Drive or AWS S3). Docketra stores metadata and orchestrates workflows. This eliminates compliance liability/data custody paranoia for professional practitioners and drops Docketra's marginal hosting storage costs near zero.
  - **Intake-to-Docket Flow**: Intake link / form → lead pipeline → client entity → docket work item with QC review stage.
- **Packaging & Pricing Structure**:
  - **100% Feature Parity**: All tiers include CMS intake forms, CRM pipeline, Workbasket/Dockets execution, BYOS storage integration, and audit logs. No artificial feature paywalls.
  - **Tier Gating is Purely User/Seat-Based**:
    - **Free Tier**: Free forever for up to 2 users (designed for solo practitioners + 1 assistant/trainee, driving viral adoption).
    - **Starter Tier**: ₹2,499 / month (~$30/mo) per firm for up to 5 team members (ideal for 3–5 person partnership firms; ₹24,990/year billed annually).
    - **Pro Tier**: ₹6,999 / month (~$85/mo) per firm for unlimited team members (for growing firms with 6+ staff, multiple teams/branches; ₹69,990/year billed annually).
- **Go-to-Market & Acquisition**:
  - Product-led growth with free 2-user tier for solo practitioners and article clerks.
  - Professional community distribution: ICSI / ICAI study circles, local chapter seminars, compliance practitioner networks.
  - Direct founder outreach and peer-referrals among partner firms.
- **Constraints & Context**:
  - Bootstrapped engineering-led product.
  - Cloud stack: Node.js, Express, MongoDB, Redis, React.
  - Low fixed operating overheads; near-zero per-tenant variable file storage costs.
