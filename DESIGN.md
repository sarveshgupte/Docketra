# Docketra — Design Direction & System Specification

> High-Craft Design System & Architecture Specification for Docketra.
> Standard: Awwwards Site of the Day / Elite B2B SaaS (Linear, Attio, Stripe, Mercury).

---

## 1. The Concept Card

- **Product**: Docketra — The Sovereign Practice Vault & Operating System for Indian Professional Firms (CAs, CSs, Legal Practices).
- **The Central Metaphor**: *The Sovereign Practice Ledger & High-Security Vault*. 
  Not a messy web of loose Google Drive links, article clerk personal WhatsApp folders, or Excel trackers. Docketra is a precision-machined regulatory engine where every client document remains strictly within the firm's private Google Drive perimeter, article clerk downloads are sealed by the Trainee Laptop Shield, and statutory dockets lock with SQC-1 maker-checker partner sign-off.
- **The Signature Moment**: *The Sovereign Custody & Trainee Shield Interactive Stage*.
  An interactive, real-time workspace simulator directly inside the hero and trust sections. Visitors toggle between:
  1. **Article Clerk Laptop View**: Live visualization of blocked local file downloads, watermarked previews, and zero data leakage on personal trainee laptops.
  2. **Partner SQC-1 Audit Ledger**: One-click QC approval, MCA V3 / Form 3CD / GSTR-3B challan verification, and immutable statutory audit trail timestamping.
  3. **Drive BYOS Isolation**: Live visualization showing how Docketra operates with restricted `drive.file` scope—accessing only `/Docketra/` while never touching private personal drives.
- **Target Emotion**: *Unshakable Professional Authority and Sovereign Relief*.
  A senior partner or managing CA/CS looks at the interface and feels immediate clarity: *"Finally, software built by someone who understands the weight of our regulatory liabilities, peer reviews, and client confidentiality."*
- **Motion Verb**: *"Engrave & Lock"*.
  Decisive, mathematical, and calm. High precision 200–300ms transitions (`cubic-bezier(0.16, 1, 0.3, 1)`). Zero cartoonish bounce or playful float. Every element snaps into place with the precision of a certified digital signature token.
- **Screenshot Frame**: The Hero Split.
  - Left: Sculpted typographic hierarchy, statutory badge ribbons (`MCA V3 • SQC-1 • BYOS GOOGLE DRIVE`), live practice counter, and dual high-contrast action triggers.
  - Right: The interactive `Sovereign Practice Ledger & Canvas` showcasing live dockets (Zenith Infra, Neo Retail, Apex Bio) with real CINs, due date urgency ribbons, and partner review stamps.

---

## 2. Art Direction & Visual Language

### 2.1 Palette Tokens
Docketra uses high-contrast editorial ink paired with sovereign regulatory accents:

| Token | Hex Value | Semantic Usage |
|---|---|---|
| `ground-obsidian` | `#080C14` | High-security trust zones, dark sovereign vault hero accents |
| `ground-slate` | `#0F172A` | Primary typography headers, heavy structural borders |
| `surface-clean` | `#FFFFFF` | Primary canvas cards, active dockets, high readability |
| `surface-subtle` | `#F8FAFC` | Data tables, alternating ledger rows, secondary backgrounds |
| `hairline-light` | `#E2E8F0` | Razor-sharp 1px border dividers in light mode |
| `hairline-dark` | `#1E293B` | Hairline border dividers in sovereign vault sections |
| `authority-emerald` | `#10B981` | Custody verified, Google Drive connected, 0 file leakage |
| `statutory-amber` | `#D97706` | Statutory due date warnings, late fee countdowns, highlight badges |
| `regulatory-indigo` | `#4F46E5` | Active maker-checker workflow, matter routing, partner check |
| `urgent-rose` | `#E11D48` | Overdue MCA/ROC/Tax filings, immediate partner action required |

### 2.2 Typography Scale
- **Primary Sans Typeface**: **DM Sans** (`'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) — geometric, clean, modern, institutional authority.
- **Display Hero**: 44px - 56px (`text-3xl sm:text-4xl lg:text-[3.25rem]`), font-weight 800, tight kerning (`tracking-[-0.035em]`), leading 1.08.
- **Section Titles**: 28px - 36px (`text-2xl sm:text-3xl`), font-weight 700, tight kerning (`tracking-[-0.025em]`).
- **Card / Module Headings**: 16px - 18px (`text-base sm:text-lg`), font-weight 700.
- **Body Text**: 14px - 15px (`text-sm sm:text-[15px]`), font-weight 400, leading 1.6, slate-600.
- **Statutory / Monospace**: JetBrains Mono / SF Mono / Consolas (`font-mono`), 10px - 12px, tracking wide (`tracking-wider` or `tracking-tight`), uppercase for form numbers and CINs (`U72200MH2021PTC368942`, `AOC-4`, `MGT-7`, `3CD`).

### 2.3 Shapes & Physicality
- **Borders**: Crisp 1px solid (`border border-slate-200` or `border border-slate-800`).
- **Corner Radii**: Strictly disciplined: `rounded-xs` (1px) to `rounded-md` (4px) or `rounded-lg` (6px) for cards. No blobby pill shapes that look like consumer toy apps.
- **Shadows**: Precise multi-layered architectural shadows: `0 1px 2px 0 rgba(15, 23, 42, 0.05), 0 8px 16px -4px rgba(15, 23, 42, 0.08)`.

---

## 3. Structural Wireframes

```
+-----------------------------------------------------------------------------------+
| [BubbleMenu / Header: Concentric Golden 'D' Logo • Solutions • Auth Triggers]     |
+-----------------------------------------------------------------------------------+
| HERO SECTION                                                                      |
| [Kicker: Built for Indian CA, CS & Legal Firms • BYOS Google Drive • SQC-1 Ready]  |
| "The Sovereign Practice OS for Indian Professional Firms."                        |
| Subtitle: Keep all client files in your private Google Drive. Block junior        |
| laptop downloads. Zero file leakage, 100% partner sign-off.                       |
|                                                                                   |
| [CTAs: Create Workspace → | Find Workspace | Live Interactive Tour]               |
| [Live Metric Badges: ₹0 Sandbox • 100% Drive Custody • 2-Min Setup]               |
|                                                                                   |
| [Right Column: Interactive Sovereign Practice Vault Window]                       |
| [Tabs: Due Dates (3 Overdue) | Staff Worklists (8) | Client Vault (42) | Drive]   |
+-----------------------------------------------------------------------------------+
| REAL-TIME METRICS & SOVEREIGNTY PROOF STRIP                                       |
| [Zero Outside Access] [Trainee Laptop Shield] [100% Partner Sign] [1-Click Restore]
+-----------------------------------------------------------------------------------+
| PRACTICE MATRIX (DOMAIN TABS)                                                     |
| [Company Secretaries (PCS)]  [Chartered Accountants (CA)]  [Corporate Legal Teams]|
| - MCA V3 / ROC Filings        - Tax Audit Form 3CD         - NCLT & High Court   |
| - Annual Returns (MGT-7)      - GSTR-9 & 3B Reconciliation - Board Minutes & AGM |
| - Director DIR-3 KYC          - Client Upload Link (₹0 login)- Contract Repository|
+-----------------------------------------------------------------------------------+
| INTERACTIVE CUSTODY STAGE & COMPARISON                                            |
| [The Vulnerable Firm (WhatsApp / Excel)] vs [The Docketra Sovereign Fortress]     |
| - Files on trainee desktop                 - Files sealed in firm Drive           |
| - Client PAN sent on personal chat         - Watermarked protected viewer        |
| - Missed AOC-4 due date penalty            - Automated statutory radar alerts     |
| - No record of who changed what            - Peer-review SQC-1 maker-checker      |
+-----------------------------------------------------------------------------------+
| STATUTORY LIFECYCLE LEDGER (HOW WORK MOVES)                                       |
| 01. Intake & Docket Opening  →  02. Trainee Workbasket  →                         |
| 03. Drive Working Papers    →  04. Partner SQC-1 Sign-off & Government Filing     |
+-----------------------------------------------------------------------------------+
| FOUNDING FIRMS & PIONEER 30 PRICING ARCHITECTURE                                  |
| [Free Pilot: ₹0 Forever] [Pioneer 30: ₹12,990/yr Flat] [Growth: ₹21,990/yr]      |
| [30-Day Money-Back Guarantee: "If it doesn't save 10 hours a week, 100% refund"]  |
+-----------------------------------------------------------------------------------+
| FINAL CONVERTING CTA & SOVEREIGN SIGN-OFF                                         |
+-----------------------------------------------------------------------------------+
| FOOTER (Full statutory compliance, solutions, legal links: Terms, Privacy, etc.)  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Interaction & Motion Rules
1. **Header Navigation**: Smooth scroll with exact header offset calculation (`84px`).
2. **Interactive Vault Canvas**: Zero lag state switches. Real clipboard copy feedback (`[COPIED]` with 1.8s timeout).
3. **Motion Curves**:
   - Entry: `ease: [0.16, 1, 0.3, 1]`, duration: 300ms.
   - Hover cards: subtle 1px border highlight shift from `#E2E8F0` to `#94A3B8` (light) or `#334155` to `#64748B` (dark).
4. **Performance & Reliability**:
   - Zero external font / CDN dependencies to ensure 100% prerendering determinism.
   - Semantic HTML and WCAG 2.2 AA contrast verified.
