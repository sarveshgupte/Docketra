import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice Management Software for Chartered Accountants | Docketra',
  description:
    'Purpose-built practice management for Indian CA firms. Streamline audit dockets, GST reconciliations, and tax reviews with zero spreadsheet chaos. Claim 3 months free.',
};

const FAQ_ITEMS = [
  {
    question: 'How do role-based permissions work for article trainees and audit staff?',
    answer:
      'Docketra provides strict Role-Based Access Control (RBAC) designed specifically for CA firms. Partners can scope article assistants, paid assistants, and audit seniors strictly to assigned client entities or specific workbaskets (e.g., GST or Statutory Audit). Trainees cannot access confidential partner billing rates, other partners\' clients, or submit final filings without mandatory partner sign-off.',
  },
  {
    question: 'Where is client financial data stored and how is domestic data residency handled?',
    answer:
      'All client financial data, audit working papers, and tax documents are hosted exclusively on Tier-IV cloud infrastructure located physically within India (Mumbai and Hyderabad). We enforce TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. Furthermore, Docketra supports Bring-Your-Own-Storage (BYOS)—allowing your firm to vault working papers directly into your own firm\'s Google Drive or AWS S3 account with zero vendor lock-in.',
  },
  {
    question: 'Can we export our firm\'s complete data if we choose not to renew after the 3-month free pilot?',
    answer:
      'Yes, 100%. Docketra gives you complete data ownership with zero lock-in. You can export your entire client master list, historical docket audit trails, statutory registers, and work papers in clean Excel/CSV formats and organized ZIP archives anytime with a single click. We never hold your firm data hostage and charge zero export fees.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

const REALITY_CHECK_MATRIX = [
  {
    title: 'Filing Deadlines Packed into Months',
    legacy: 'Static Rows in Master Spreadsheets',
    legacyDetail:
      'Tax audit, GSTR-9/9C, and MCA due dates tracked in giant multi-tab spreadsheets where dates must be manually recalculated after government extensions.',
    risk: 'Late Fees & Penalty Scrutiny',
    riskDetail:
      'Cells get accidentally overwritten. Critical client filings slip past statutory cutoffs, triggering hefty late fees, interest under 234A/B/C, and client escalations.',
    docketra: 'Dynamic Statutory Timelines with Automated Alerts',
    docketraDetail:
      'Dynamic compliance calendar automatically maps Income Tax, GST, and ROC deadlines across all clients with escalating SLA alerts and auto-calculated late fee countdowns.',
    badge: 'Zero Missed Filings',
  },
  {
    title: 'Reviewing Tax Drafts on WhatsApp',
    legacy: 'Buried Chat Messages & Forwarded Attachments',
    legacyDetail:
      'Computation sheets, GSTR-3B summaries, and draft audit reports pinged across WhatsApp groups and personal emails with zero formal review checkpoints.',
    risk: 'Unreviewed Returns Filed on Portals',
    riskDetail:
      'Article assistants file returns with unresolved reconciliation mismatches or incorrect turnover figures, leading to departmental defect notices and partner embarrassment.',
    docketra: 'Structured 4-Eye QC Review Baskets',
    docketraDetail:
      'Mandatory review gates. Dockets cannot advance to portal submission until assigned audit managers or partners review draft computations, log notes, and grant immutable digital sign-offs.',
    badge: '100% Quality Gate',
  },
  {
    title: 'Article Assistant Turnover',
    legacy: 'Vanishing Working Papers & Local Downloads',
    legacyDetail:
      'Article clerks rotate out every 2–3 years. Working papers, client trial balance notes, DSC PINs, and portal passwords remain trapped on personal laptops or private drives.',
    risk: 'Institutional Brain Drain & Re-Work',
    riskDetail:
      'Every new trainee spends weeks re-requesting past filings, ledger summaries, and assessment orders from irritated clients, damaging firm credibility.',
    docketra: 'Persistent Entity Client Memory',
    docketraDetail:
      'Centralized permanent client workspace. Past computation sheets, scrutiny replies, signed balance sheets, and client correspondence stay permanently bound to the firm workspace.',
    badge: 'Zero Knowledge Loss',
  },
  {
    title: '"Who is Working on What?" Panic',
    legacy: 'Hours Lost in Daily Partner Status Syncs',
    legacyDetail:
      'Partners spend the first 2 hours of every morning in September and October calling team members to ask: "Who is doing Acme Tax Audit? Did we file the GSTR-1 for Beta Corp?"',
    risk: 'Capacity Blind Spots & Bottlenecks',
    riskDetail:
      'Uneven workload distribution. Senior trainees burn out while junior staff sit idle, and partners discover stalled filings only days before statutory cutoffs.',
    docketra: 'Live Firm Worklist Telemetry',
    docketraDetail:
      'Real-time partner command center. View open dockets across all clients, track fee-earner capacity, identify review bottlenecks, and balance workload in seconds.',
    badge: 'Real-Time Telemetry',
  },
];

const PILLARS = [
  {
    number: '01',
    title: 'Multi-Discipline Workbaskets',
    subtitle: 'Direct Tax, GST, Audit & Corporate Advisory',
    description:
      'Organize your firm into specialized, sovereign work queues. Route dockets automatically to Tax, GST, Statutory Audit, Transfer Pricing, and ROC teams without cross-department clutter.',
    features: [
      'Pre-built practice workbaskets: Direct Tax, Indirect Tax (GST), Statutory Audit, MCA/ROC',
      'Intelligent routing rules based on client group, turnover, and engagement type',
      'Custom subcategories for Tax Audit (3CD), Transfer Pricing (3CEB), and Advance Tax',
      'Stage-based pipelines with configurable milestone checkpoints and review stages',
    ],
  },
  {
    number: '02',
    title: 'Client Memory & Working Records',
    subtitle: 'Permanent Dossiers & Scrutiny Repository',
    description:
      'Give your practice an institutional brain. Centralize permanent client dossiers, PAN/GSTIN registries, past assessment orders, 26AS/AIS reconciliation notes, and representation letters.',
    features: [
      'Permanent client files: MOA/AOA, Partnership Deeds, GST registration certificates, PAN/TAN',
      'Historical scrutiny and assessment order archive with DIN/Notice tracking',
      'Client contacts and authorized signatory registry with validity dates',
      'Direct link to working papers stored securely in your firm’s Google Drive or AWS S3',
    ],
  },
  {
    number: '03',
    title: '4-Eye QC Review Gates',
    subtitle: 'Partner & Manager Quality Safeguards',
    description:
      'Prevent unvetted returns and audit opinions from reaching government portals. Enforce multi-tier digital sign-offs between article trainees, audit managers, and signing partners.',
    features: [
      'Mandatory review checkpoints before filing returns on IT, GST, or MCA portals',
      'Inline review annotations, queries, and correction checklists for audit staff',
      'Immutable audit trail recording reviewer identity, timestamp, and digital sign-off',
      'Partner override controls with mandatory justification logging for urgent filings',
    ],
  },
  {
    number: '04',
    title: 'Zero-Friction Spreadsheet Migration',
    subtitle: 'Migrate Your Entire Firm in 15 Minutes',
    description:
      'Switch your entire client base and ongoing compliance matters from Excel, Tally, or legacy software with zero manual re-entry. High-speed bulk ingestion engines handle the rest.',
    features: [
      'Client Master Importer with dry-run validation for PAN, GSTIN, TAN, and CIN formats',
      'Direct clipboard copy-paste from Excel or Google Sheets without downloading CSV files',
      'Historical docket and pending compliance matter migration templates',
      'Automated team role provisioning and associate workbasket assignment',
    ],
  },
];

export default function CharteredAccountantsSolutionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500/30 font-sans">
      {/* JSON-LD FAQPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      {/* Pilot Notification Eyebrow */}
      <div className="sticky top-0 z-50 border-b border-amber-500/20 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 text-center text-xs sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 font-bold text-amber-400">
            🚀 Docketra Pilot Cohort for CA Practices
          </span>
          <span className="text-slate-300 font-medium">
            3 Months Unrestricted Free Access • Pre-configured with Tax, Audit & GST Workbaskets
          </span>
          <a
            href="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Claim CA Pilot Seat →
          </a>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white">
            <svg className="h-8 w-8 text-amber-500 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight">Docketra</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-0.5">The Company Brain</span>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-xs font-semibold text-slate-300 hover:text-white transition-colors">
              Sign In
            </a>
            <a
              href="/signup"
              className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-sm"
            >
              Start 3-Month Free Pilot
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-6">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Built for Managing Partners & Audit Practice Heads
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
            The Operating Engine for{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-emerald-400 bg-clip-text text-transparent">
              High-Velocity CA Practices
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Stop managing audit working papers, GST reconciliations, and tax scrutiny deadlines across WhatsApp threads and fragile spreadsheets. Run your entire firm on a unified, sovereign compliance workspace.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="/signup"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-7 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-lg shadow-amber-500/20"
            >
              Start 3-Month Free Pilot →
            </a>
            <a
              href="#preview"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white active:scale-[0.97] transition-all"
            >
              Explore Sandbox Preview
            </a>
          </div>

          {/* Risk-reversal Subtext */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              No credit card required
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Full practice access
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              1-Click Excel client master import
            </span>
          </div>
        </div>

        {/* Hero Visual Mockup: CA Operations Engine */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 sm:p-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* The Fragmented Way */}
            <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-red-900/30 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">Spreadsheets & WhatsApp</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Tax Season Chaos</span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 font-mono text-[11px]">
                  <span className="text-red-400 font-bold">❌ September_TaxAudit_Master_v12.xlsx:</span> Form 3CD row 84 edited offline. Balance sheet variance unflagged.
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20">
                  <p className="text-slate-400 text-[11px] font-semibold mb-1">WhatsApp Group "Audit Articles 2026":</p>
                  <p className="italic text-slate-300">"Sir, where did Rahul save the 26AS reconciliation for Apex Mills? He finished articleship yesterday and laptop is locked."</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 text-red-300 text-[11px]">
                  ⚠️ Result: Missed filing cutoffs. Interest under 234A/B. Frantic partner firefighting.
                </div>
              </div>
            </div>

            {/* The Modern Way: Docketra CA */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">The Docketra CA Standard</span>
                </div>
                <span className="text-[11px] font-bold text-amber-400">Firm Command Engine</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-amber-300">DOCKET-2026-TAX-094</span>
                    <span className="rounded bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 border border-emerald-800 text-[10px]">Partner Signed Off</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1 font-medium">Apex Mills Ltd • Form 3CD & ITR-6 Filing</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">PAN: AAACA1234F • Audit Workbasket • 4-Eye Gate Verified</p>
                </div>
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-[11px] font-semibold">26AS / AIS Working Papers Vaulted</p>
                    <p className="text-slate-400 text-[10px]">Stored in Firm Google Drive • UDIN Generated & Bound</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">100% Audit-Proof</span>
                </div>
                <div className="rounded-lg bg-emerald-950/20 p-2 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  ✅ Result: Zero missed deadlines. Absolute audit quality control. Calm practice growth.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Reality Check Matrix */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-3">
              Spreadsheets & WhatsApp vs. The Risk to the Firm vs. Docketra
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              The Reality Check Matrix
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Tax and audit compliance demand zero-error execution under severe statutory deadlines. See why spreadsheets fail at scale and how Docketra transforms CA practice operations.
            </p>
          </div>

          <div className="space-y-6">
            {REALITY_CHECK_MATRIX.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden hover:border-slate-700 transition-all shadow-lg"
              >
                <div className="border-b border-slate-800/80 px-6 py-4 bg-slate-900/50 flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {item.title}
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400">
                    {item.badge}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
                  {/* Legacy Spreadsheets & WhatsApp */}
                  <div className="p-5 bg-slate-950/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      <span className="text-slate-500">1.</span>
                      <span>Spreadsheets & WhatsApp</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 mb-1">{item.legacy}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.legacyDetail}</p>
                  </div>

                  {/* The Risk to the Firm */}
                  <div className="p-5 bg-red-950/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                      <span>✕</span>
                      <span>The Risk to the Firm</span>
                    </div>
                    <p className="text-xs font-semibold text-red-300 mb-1">{item.risk}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.riskDetail}</p>
                  </div>

                  {/* The Docketra CA Standard */}
                  <div className="p-5 bg-amber-500/[0.03]">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                      <span>✓</span>
                      <span>The Docketra CA Standard</span>
                    </div>
                    <p className="text-xs font-semibold text-white mb-1">{item.docketra}</p>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">{item.docketraDetail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars Deep Dive */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-3">
              CA Practice Architecture
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Pillars of the Docketra CA Platform
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Purpose-engineered to handle intense Indian tax filing crunches, rigorous audit documentation, and multi-associate teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono text-sm font-bold text-amber-400">
                      {pillar.number}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-400">
                      {pillar.subtitle}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                    {pillar.description}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">
                    Key Functionality:
                  </div>
                  {pillar.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Anchor Section */}
      <section id="preview" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 shadow-2xl">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-0.5 text-xs font-semibold text-amber-400 mb-3">
              Interactive Preview
            </div>
            <h3 className="text-xl sm:text-3xl font-extrabold text-white">
              The CA Partner Command Center
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Live practice telemetry: direct tax dockets, 4-eye review queues, and audit working records.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-400">docketra.in/app/firm/khanna-and-associates-ca</span>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                Live CA Firm Workspace
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Tax Audit 3CD Matters</p>
                  <p className="text-xl font-bold text-white mt-1">48 Engagements</p>
                  <p className="text-[10px] text-emerald-400 mt-1">100% on schedule</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Partner QC Sign-offs</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">7 Returns Pending</p>
                  <p className="text-[10px] text-amber-400 mt-1">4-eye review gate active</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Upcoming GSTR-9 Due Dates</p>
                  <p className="text-xl font-bold text-white mt-1">32 Clients</p>
                  <p className="text-[10px] text-slate-400 mt-1">Auto-reconciliation ready</p>
                </div>
              </div>

              {/* Sample Matter Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-3">
                  <span>Active CA Engagement Roster</span>
                  <span className="text-amber-400 font-mono text-[11px]">Filter: Direct Tax & Audit Baskets</span>
                </div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">Shree Ganesh Logistics Private Limited</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">PAN: AAGCS9281H • Lead: Rahul (Article Senior)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                        Form 3CD + 3CA
                      </span>
                      <span className="rounded bg-emerald-950/80 text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-800">
                        Manager QC Passed
                      </span>
                    </div>
                  </div>
                  <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">Metropolis HealthCare Diagnostics LLP</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">GSTIN: 27AABCM8291F1Z8 • Lead: Priya (Associate)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                        GSTR-9C Reconciliation
                      </span>
                      <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono">
                        Working Papers Uploaded
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Pilot Program Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Official CA Pilot Cohort</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Why Join the 3-Month Free Pilot?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Partner with Docketra to eliminate spreadsheet anxiety and run an audit-proof, calm compliance practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                90d
              </div>
              <h4 className="text-base font-bold text-white">100% Free Full Firm Workspace</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                90 days of unrestricted access for all partners, managers, article trainees, and paid assistants with unlimited clients and dockets.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                🤝
              </div>
              <h4 className="text-base font-bold text-white">White-Glove Client Migration</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Our engineers validate and import your current Excel client lists, ongoing tax audit trackers, and staff assignments at zero cost.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                ⚡
              </div>
              <h4 className="text-base font-bold text-white">Direct Founder & Product Hotline</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct WhatsApp and Slack access to Docketra product engineers to request custom tax schedules, audit checklists, and practice reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Frequently Asked Questions</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Everything You Need to Know About the CA Pilot
            </h3>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => (
              <details
                key={idx}
                className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 open:bg-slate-900 transition-all [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between text-sm sm:text-base font-bold text-white select-none">
                  <span>{item.question}</span>
                  <span className="ml-4 shrink-0 rounded-full border border-slate-700 p-1 text-slate-400 group-open:rotate-180 transition-transform duration-200">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing Conversion Banner */}
      <section className="border-t border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-4">
            Zero Financial Commitment • Limited Pilot Cohort
          </div>
          <h3 className="text-2xl sm:text-4xl font-black text-white">
            Upgrade Your CA Practice Ahead of the Next Filing Cycle
          </h3>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Join forward-thinking CA practices running calm, audit-ready compliance. Start your 3-month pilot in under 5 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/signup"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-8 py-4 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-xl shadow-amber-500/20"
            >
              Start Your 3-Month Free Pilot →
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            3 Months Free • Zero Financial Commitment • Instant Excel Import • Dedicated CA Onboarding Specialist
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <span className="text-amber-500">✦</span>
            <span>Docketra</span>
            <span className="text-slate-500 font-normal">— The Company Brain for Indian Firms</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/security" className="hover:text-white transition-colors">Security</a>
            <a href="/contact" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
