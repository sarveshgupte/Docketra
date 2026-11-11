import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal Operations & Matter Management for In-House Teams | Docketra',
  description:
    'Streamline in-house legal intake, contract dockets, and subsidiary compliance. Purpose-built for Indian corporate legal departments with a 3-month free pilot.',
};

const FAQ_ITEMS = [
  {
    question: 'How do role-based permissions work for business teams submitting legal intake requests?',
    answer:
      'Docketra provides granular Role-Based Access Control (RBAC) separating internal business requesters from legal department counsel. Business users access a simplified intake portal where they can submit requests, upload contract drafts, and track progress without gaining visibility into confidential dispute dockets, executive employment matters, or board governance archives.',
  },
  {
    question: "How does Docketra ensure data sovereignty and compliance with India's Digital Personal Data Protection (DPDP) Act?",
    answer:
      'Docketra enforces strict domestic data residency. All customer data and documents are stored exclusively on Tier-IV data center infrastructure located physically within India (Mumbai and Hyderabad). We employ TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. In-house teams can also activate Bring-Your-Own-Storage (BYOS) to vault documents directly into their own enterprise AWS S3 or Google Drive buckets.',
  },
  {
    question: 'How straightforward is migrating ongoing litigation matters and contract repositories from Excel?',
    answer:
      'Migration takes minutes using Docketra\'s built-in Matter & Entity Importers. You can upload existing spreadsheets containing active litigation, regulatory show-cause notices, contract registries, and subsidiary entity profiles. The system runs pre-flight dry runs, checks statutory identifiers (CIN, DIN, PAN), and auto-populates matter dockets with historical dates and responsible counsel.',
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
    title: 'Ad-Hoc Intake via Chat',
    legacy: 'Drive-By Pings & Informal Threads',
    legacyDetail:
      'Business teams request contract reviews, NDA approvals, and advisory via Slack, WhatsApp, and fragmented email chains with no standardized briefing or SLA tracking.',
    risk: 'Untracked Requests & Blown SLAs',
    riskDetail:
      'High-priority commercial contracts sit forgotten in inboxes. Deals stall, turnaround times become unpredictable, and counsel has zero paper trail when disputes arise.',
    docketra: 'Structured Legal Front Door & Intake Baskets',
    docketraDetail:
      'A unified legal front door. Business stakeholders submit standardized intake requests with contract metadata, automated routing to specialized counsel, and live status countdowns.',
    badge: 'Zero Dropped Requests',
  },
  {
    title: 'Scattered Regulatory Notices',
    legacy: 'Local Desktop Folders & Forwarded Mail',
    legacyDetail:
      'Show-cause notices, labor inspection summons, and GST/ROC letters arrive across regional plants and branch offices, saved on individual laptops or lost in forwarded emails.',
    risk: 'Missed Court/Tribunal Filing Windows',
    riskDetail:
      'Statutory reply deadlines lapse without response. Ex-parte orders, contempt proceedings, and compounding penalties accumulate across decentralized subsidiaries.',
    docketra: 'Centralized Matter Dockets with SLA Tracking',
    docketraDetail:
      'Unified regulatory matter docketing. Every notice is timestamped, mapped to statutory reply windows, assigned to lead litigation counsel, and tracked with automated escalation alerts.',
    badge: '100% Notice Defensibility',
  },
  {
    title: 'External Counsel Blind Spots',
    legacy: 'Opaque Retainer Billing & Phone Check-ins',
    legacyDetail:
      'External law firms and designated advocates work on litigation and corporate opinions with minimal visibility between monthly billing cycles and informal phone calls.',
    risk: 'Ballooning Legal Spend & Duplicated Effort',
    riskDetail:
      'Legal budgets spiral out of control. Outside counsel duplicates prior internal research, billable hours balloon without clear deliverable milestones, and budget overruns shock leadership.',
    docketra: 'Milestone-Driven Docket Tracking',
    docketraDetail:
      'Assign external law firms to scoped dockets with clear deliverable milestones, hearing dates, and spend tracking. Enforce transparency before invoices are approved.',
    badge: 'Spend Accountability',
  },
  {
    title: 'Executive Reporting Headaches',
    legacy: 'Manual Slide Decks & Weekend Spreadsheet Merges',
    legacyDetail:
      'Before board meetings and audit committees, the General Counsel spends 3 days frantically chasing team members to compile matter spreadsheets into executive slide presentations.',
    risk: 'Unprepared Board Updates & Reactive Posture',
    riskDetail:
      'Static slides are out of date before the board meeting begins. Legal leadership remains reactive, lacking real-time metrics on legal team velocity, litigation exposure, and risk posture.',
    docketra: 'Real-Time GC Command Dashboard',
    docketraDetail:
      'Instant executive telemetry on active litigation, contract turnaround times, subsidiary compliance health, and pending approvals. Export board-ready reports with one click.',
    badge: 'Instant Board Telemetry',
  },
];

const PILLARS = [
  {
    number: '01',
    title: 'Structured Legal Intake & Triage',
    subtitle: 'Internal Front Door & Queue Routing',
    description:
      'Establish a single front door for commercial contracts, corporate advisory, and statutory sign-offs. Eliminate drive-by pings and centralize work in intelligent workbaskets.',
    features: [
      'Standardized intake forms with contract type, commercial value, and urgency tagging',
      'Automated triage routing to specialized counsel (Employment, IP, Commercial, Regulatory)',
      'Real-time requester tracking portal with estimated turnaround countdowns',
      'Configurable SLA tiers based on commercial priority and business unit',
    ],
  },
  {
    number: '02',
    title: 'Entity & Subsidiary Governance',
    subtitle: 'Group Corporate Records & Director Intelligence',
    description:
      'Manage corporate records across holding companies, operating subsidiaries, and joint ventures in India and overseas. Keep group governance perfectly synchronized.',
    features: [
      '21-digit CIN validation, DIN tracking, and DSC expiration registries for all directors',
      'Centralized repository for Articles, Memorandum, shareholding charts, and board minutes',
      'Power of Attorney (PoA) and authorized signatory registry with validity dates',
      'Automated statutory compliance dockets for annual filings and event-driven ROC forms',
    ],
  },
  {
    number: '03',
    title: '4-Eye QC Review Baskets',
    subtitle: 'Risk Controls Before Dispatch',
    description:
      'Ensure high-stakes commercial agreements, court filings, and regulatory responses pass rigorous peer or GC review before execution or external submission.',
    features: [
      'Mandatory approval gates for contracts exceeding custom monetary thresholds',
      'Complete inline redline history, revision comments, and risk commentary',
      'Immutable digital sign-off trail with counsel timestamp and role authentication',
      'Configurable dual-counsel review gates for litigation replies and affidavit sign-offs',
    ],
  },
  {
    number: '04',
    title: 'Sovereign Domestic Infrastructure',
    subtitle: 'Strict Legal Privilege & Indian Data Residency',
    description:
      'Engineered specifically to preserve attorney-client privilege, data residency mandates, and compliance with the Digital Personal Data Protection (DPDP) Act, 2023.',
    features: [
      'Hosted exclusively on Tier-IV cloud infrastructure within India (Mumbai / Hyderabad)',
      'Zero training on third-party commercial LLMs—your enterprise legal data remains private',
      'Optional Bring-Your-Own-Storage (BYOS) to firm AWS S3 or Google Drive accounts',
      'Granular Role-Based Access Control (RBAC) with detailed immutable audit logging',
    ],
  },
];

export default function CorporateLegalTeamsSolutionPage() {
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
            🚀 Docketra Enterprise Pilot Cohort
          </span>
          <span className="text-slate-300 font-medium">
            3 Months Unrestricted Free Access for In-House Legal Teams • Tier-IV Indian Data Residency
          </span>
          <a
            href="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Claim Enterprise Seat →
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
            Built for General Counsel, Legal Ops & Corporate Secretaries
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
            Total Operational Clarity for{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-emerald-400 bg-clip-text text-transparent">
              In-House Legal & Compliance
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Replace fragmented email threads, forgotten advisory requests, and scattered contract dockets. Centralize internal legal intake, regulatory notices, and board governance inside a single sovereign workspace.
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
              Full team access
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              1-Click Excel matter migration
            </span>
          </div>
        </div>

        {/* Hero Visual Mockup: Legal Operations Command */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 sm:p-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* The Fragmented Way */}
            <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-red-900/30 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">Spreadsheets & Slack</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Fragmented & Untracked</span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 font-mono text-[11px]">
                  <span className="text-red-400 font-bold">❌ Slack #legal-requests:</span> "Can someone review the vendor MSA? We signed it yesterday without indemnity clause."
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20">
                  <p className="text-slate-400 text-[11px] font-semibold mb-1">Litigation_Tracker_2026_Final.xlsx:</p>
                  <p className="italic text-slate-300">"Notice from NCLT Mumbai missing from folder. Hearing scheduled for tomorrow morning."</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 text-red-300 text-[11px]">
                  ⚠️ Result: High-liability blind spots. Blown contractual SLAs. Ballooning outside counsel fees.
                </div>
              </div>
            </div>

            {/* The Modern Way: Docketra Legal */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">The Docketra Legal Standard</span>
                </div>
                <span className="text-[11px] font-bold text-amber-400">Enterprise Legal Ops</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-amber-300">DOCKET-2026-LEG-088</span>
                    <span className="rounded bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 border border-emerald-800 text-[10px]">GC Approved</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1 font-medium">Enterprise SaaS Agreement • ₹4.2 Cr Annual Contract</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Commercial Legal Basket • Turnaround: 22h • 4-Eye Gate Passed</p>
                </div>
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-[11px] font-semibold">NCLT Show-Cause Matter Vaulted</p>
                    <p className="text-slate-400 text-[10px]">Assigned to Senior Counsel • Reply filed 4 days ahead of window</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">100% Compliant</span>
                </div>
                <div className="rounded-lg bg-emerald-950/20 p-2 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  ✅ Result: Zero dropped requests. Protected legal privilege. Executive audit readiness.
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
              Spreadsheets & Slack vs. The Enterprise Risk vs. Docketra
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              The Reality Check Matrix
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Corporate legal teams cannot afford communication gaps or missed statutory windows. See how Docketra elevates your legal operations from reactive firefighting to strategic leadership.
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
                  {/* Legacy Spreadsheets & Slack */}
                  <div className="p-5 bg-slate-950/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      <span className="text-slate-500">1.</span>
                      <span>Spreadsheets & Slack</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 mb-1">{item.legacy}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.legacyDetail}</p>
                  </div>

                  {/* The Enterprise Risk */}
                  <div className="p-5 bg-red-950/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                      <span>✕</span>
                      <span>The Enterprise Risk</span>
                    </div>
                    <p className="text-xs font-semibold text-red-300 mb-1">{item.risk}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.riskDetail}</p>
                  </div>

                  {/* The Docketra Legal Standard */}
                  <div className="p-5 bg-amber-500/[0.03]">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                      <span>✓</span>
                      <span>The Docketra Standard</span>
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
              Enterprise Legal Architecture
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Pillars of the Docketra In-House Platform
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Purpose-engineered to manage legal velocity, enforce risk policies, and protect enterprise corporate governance across Indian corporate entities.
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
              The General Counsel Command Center
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Live operational telemetry: internal intake triage, subsidiary records, and litigation tracking.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-400">docketra.in/app/firm/titan-enterprises-legal</span>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                Corporate Legal Workspace
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Active Legal Matters</p>
                  <p className="text-xl font-bold text-white mt-1">42 Open Dockets</p>
                  <p className="text-[10px] text-emerald-400 mt-1">Avg SLA: 1.4 days</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">4-Eye Approvals Pending</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">5 High-Value Contracts</p>
                  <p className="text-[10px] text-amber-400 mt-1">GC review gate active</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Subsidiary Governance</p>
                  <p className="text-xl font-bold text-white mt-1">14 Operating Entities</p>
                  <p className="text-[10px] text-slate-400 mt-1">100% DIN KYC compliant</p>
                </div>
              </div>

              {/* Sample Matter Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-3">
                  <span>In-House Legal Workbasket</span>
                  <span className="text-amber-400 font-mono text-[11px]">Queue: Commercial Contracts & Litigation</span>
                </div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">Master Service Agreement (Cloud Infrastructure)</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">Requester: Tech Procurement (Pune)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                        Contract Review
                      </span>
                      <span className="rounded bg-emerald-950/80 text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-800">
                        Redline Approved
                      </span>
                    </div>
                  </div>
                  <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">Commercial Trademark Opposition Notice</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">Outside Counsel: Khaitan & Partners</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                        IP Litigation
                      </span>
                      <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono">
                        Reply Due in 12d
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Enterprise Pilot Cohort</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Why Join the In-House Legal Pilot?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Partner with Docketra to build an institutional legal operating system customized to your enterprise governance workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                90d
              </div>
              <h4 className="text-base font-bold text-white">100% Free Full Enterprise Workspace</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                90 days of unrestricted access for all in-house counsel, paralegals, and internal business requesters with unlimited matter dockets.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                🤝
              </div>
              <h4 className="text-base font-bold text-white">White-Glove Data Migration</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Our legal ops engineers assist in importing existing litigation logs, contract inventories, and group subsidiary registers from Excel.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                ⚡
              </div>
              <h4 className="text-base font-bold text-white">Dedicated Legal Ops Specialist</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct Slack/Teams channel with Docketra product engineers to configure custom matter taxonomies and intake approval hierarchies.
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
              Everything You Need to Know About the In-House Pilot
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
            Zero Financial Commitment • Limited Enterprise Cohort
          </div>
          <h3 className="text-2xl sm:text-4xl font-black text-white">
            Bring Calm and Auditability to Your In-House Legal Ops
          </h3>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Join legal leaders running high-velocity, risk-managed departments. Get full access for your entire legal team free for 90 days.
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
            90 Days Free • Zero Financial Commitment • Indian Cloud Sovereignty • Dedicated Legal Ops Onboarding
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
