import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicMarketingHeader from '../../components/marketing/PublicMarketingHeader';
import { MarketingFooter } from '../../components/landing/LandingPageContent';
import Container from '../../components/layout/Container';
import SeoHead from '../../components/common/SeoHead';

const FAQ_ITEMS = [
  {
    id: 'rbac-permissions',
    question: 'How do role-based permissions work for business teams submitting legal intake requests?',
    answer:
      'Docketra provides granular Role-Based Access Control (RBAC) separating internal business requesters from legal department counsel. Business users access a simplified intake portal where they can submit requests, upload contract drafts, and track progress without gaining visibility into confidential dispute dockets, executive employment matters, or board governance archives.',
  },
  {
    id: 'sovereignty-dpdp',
    question: "How does Docketra ensure data sovereignty and compliance with India's Digital Personal Data Protection (DPDP) Act?",
    answer:
      'Docketra enforces strict domestic data residency. All customer data and documents are stored exclusively on Tier-IV data center infrastructure located physically within India (Mumbai and Hyderabad). We employ TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. In-house teams can also activate Bring-Your-Own-Storage (BYOS) to vault documents directly into their own enterprise AWS S3 or Google Drive buckets.',
  },
  {
    id: 'excel-migration',
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

export const CorporateLegalTeamsSolutionPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState('intake');

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25 font-sans">
      <SeoHead
        title="Legal Operations & Matter Management for In-House Teams | Docketra"
        description="Streamline in-house legal intake, contract dockets, and subsidiary compliance. Purpose-built for Indian corporate legal departments with a 3-month free pilot."
        canonicalPath="/solutions/corporate-legal-teams"
        jsonLd={FAQ_SCHEMA}
      />

      {/* Pilot Notification Eyebrow */}
      <div className="border-b border-amber-200/90 bg-amber-50/70 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            🚀 Docketra Enterprise Pilot Cohort
          </span>
          <span className="text-slate-700 font-medium">
            3 Months Unrestricted Free Access for In-House Legal Teams • Tier-IV Indian Data Residency
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim Enterprise Seat →
          </Link>
        </div>
      </div>

      {/* Shared Navigation Header */}
      <PublicMarketingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50/40 pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-200">
        <Container size="7xl">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Built for General Counsel, Legal Ops & Corporate Secretaries
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Total Operational Clarity for <span className="text-amber-600">In-House Legal & Compliance</span>
            </h1>

            <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-2xl mx-auto">
              Replace fragmented email threads, forgotten advisory requests, and scattered contract dockets. Centralize internal legal intake, regulatory notices, and board governance inside a single sovereign workspace.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800 rounded-md"
              >
                <span>Start 3-Month Free Pilot</span>
                <span>→</span>
              </Link>
              <a
                href="#preview"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors rounded-md"
              >
                <span>Explore Sandbox Preview</span>
              </a>
            </div>

            {/* Risk-reversal Subtext */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>No credit card required</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>Full team access</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>1-Click Excel matter migration</span>
              </span>
            </div>
          </div>

          {/* Hero Visual Mockup */}
          <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* The Fragmented Way */}
              <div className="rounded-md border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Spreadsheets & Slack</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Fragmented & Untracked</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="rounded border border-rose-200/80 bg-white p-2.5 font-mono text-[11px]">
                    <span className="text-rose-700 font-bold">Unindexed Channel #legal-requests:</span> "Can someone review the vendor MSA? We signed it yesterday without indemnity clause."
                  </div>
                  <div className="rounded border border-rose-200/80 bg-white p-2.5">
                    <p className="text-slate-500 text-[11px] font-semibold mb-1">Litigation_Tracker_2026_Final.xlsx:</p>
                    <p className="italic text-slate-700">"Notice from NCLT Mumbai missing from folder. Hearing scheduled for tomorrow morning."</p>
                  </div>
                  <div className="rounded border border-rose-200/80 bg-rose-100/60 p-2 text-rose-800 text-[11px] font-medium">
                    Result: High-liability blind spots. Blown contractual SLAs. Ballooning outside counsel fees.
                  </div>
                </div>
              </div>

              {/* The Modern Way: Docketra Legal */}
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">The Docketra Legal Standard</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 font-mono">Enterprise Legal Ops</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-900 font-mono">DOCKET-2026-LEG-088</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-200 text-[10px]">GC Approved</span>
                    </div>
                    <p className="text-slate-800 text-[11px] mt-1 font-medium">Enterprise SaaS Agreement • ₹4.2 Cr Annual Contract</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-mono">Commercial Legal Basket • Turnaround: 22h • 4-Eye Gate Passed</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-[11px] font-semibold">NCLT Show-Cause Matter Vaulted</p>
                      <p className="text-slate-500 text-[10px]">Assigned to Senior Counsel • Reply filed 4 days ahead of window</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 font-bold">100% Compliant</span>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900 text-[11px] font-medium">
                    Result: Zero dropped requests. Protected legal privilege. Executive audit readiness.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* The Reality Check Matrix */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Spreadsheets & Slack vs. The Enterprise Risk vs. Docketra</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              The Reality Check Matrix
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Corporate legal teams cannot afford communication gaps or missed statutory windows. See how Docketra elevates your legal operations from reactive firefighting to strategic leadership.
            </p>
          </div>

          <div className="space-y-4 max-w-5xl mx-auto">
            {REALITY_CHECK_MATRIX.map((item, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
              >
                <div className="border-b border-slate-100 px-5 py-3 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>{item.title}</span>
                  </h3>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                    {item.badge}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  <div className="p-4 sm:p-5 bg-slate-50/40">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 font-mono">
                      <span>1.</span>
                      <span>Spreadsheets & Slack</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mb-1">{item.legacy}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.legacyDetail}</p>
                  </div>
                  <div className="p-4 sm:p-5 bg-rose-50/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5 font-mono">
                      <span>✕</span>
                      <span>The Enterprise Risk</span>
                    </div>
                    <p className="text-xs font-semibold text-rose-900 mb-1">{item.risk}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.riskDetail}</p>
                  </div>
                  <div className="p-4 sm:p-5 bg-emerald-50/15">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5 font-mono">
                      <span>✓</span>
                      <span>The Docketra Standard</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-950 mb-1">{item.docketra}</p>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">{item.docketraDetail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pillars Deep Dive */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Enterprise Legal Architecture</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Pillars of the Docketra In-House Platform
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Purpose-engineered to manage legal velocity, enforce risk policies, and protect enterprise corporate governance across Indian corporate entities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between hover:border-slate-400 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                      {pillar.number}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-slate-500">
                      {pillar.subtitle}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-950 mb-1.5">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {pillar.description}
                  </p>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50/60 p-3.5 space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Key Functionality:
                  </div>
                  {pillar.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="text-amber-600 font-bold shrink-0">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Interactive Demo Anchor Section */}
      <section id="preview" className="py-16 bg-white border-b border-slate-200 scroll-mt-16">
        <Container size="7xl">
          <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Interactive Preview</div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                The General Counsel Command Center
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Live operational telemetry: see how Docketra organizes legal intake, group subsidiary records, and litigation dockets.
              </p>

              {/* Interactive Preview Tabs */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('intake')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'intake'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Intake & Triage Front Door
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('governance')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'governance'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Subsidiary Governance Master
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('litigation')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'litigation'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Litigation & Notice Dockets
                </button>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-slate-50 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-slate-500 truncate">
                    docketra.in/app/firm/titan-enterprises-legal
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  Corporate Legal Workspace
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'intake' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Active Requests in Queue</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">18 Open</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">Avg SLA: 24h turnaround</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">4-Eye Approvals Pending</p>
                        <p className="text-lg font-bold text-amber-700 mt-0.5">4 Contracts</p>
                        <p className="text-[10px] text-amber-800 mt-0.5">GC review gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">SLA Compliance Rate</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">98.4%</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">Top quartile velocity</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Internal Legal Intake Queue</span>
                        <span className="text-amber-700 font-mono text-[11px]">Filter: High Priority Commercial</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Vendor Master Agreement (₹6.5 Cr Hardware Proc.)</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">Requester: Infrastructure Ops</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              Commercial Contract
                            </span>
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                              Counsel Assigned
                            </span>
                          </div>
                        </div>
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Customer Data Processing Addendum (DPDP Alignment)</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">Requester: Product Engineering</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              Privacy & Regulatory
                            </span>
                            <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-mono">
                              Under Review
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'governance' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">Group Entity & Subsidiary Roster</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold">14 Subsidiaries • All Compliant</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-4">
                        Direct synchronization of director DINs, DSC tokens, and corporate resolutions across holding and operating entities.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Titan Digital Technologies Private Limited</p>
                            <p className="text-[11px] text-slate-500 font-mono">CIN: U72900MH2021PTC368291 • 4 Directors • PoA Registry Active</p>
                          </div>
                          <span className="rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200 font-mono">
                            100% Up-to-Date
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Titan Logistics & Supply Chain Limited</p>
                            <p className="text-[11px] text-slate-500 font-mono">CIN: L63090KA2017PLC098765 • Board Meeting Notice Dispatched</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Board Meeting 24-Sep
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'litigation' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">Regulatory Notice & Litigation Docketing</span>
                        <span className="text-amber-800 font-mono text-[11px] font-bold">Statutory Clocks Active</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Track show-cause notices, tribunal hearings, outside counsel assignments, and statutory reply dates.
                      </p>
                      <div className="space-y-2">
                        <div className="p-3 rounded border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900">NCLT Mumbai Bench: CP(IB) No. 412/MB/2026</span>
                            <p className="text-[11px] text-slate-500">Designated Advocate: Senior Counsel Sh. M. Rao • Next Hearing: 14 Oct</p>
                          </div>
                          <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-0.5">
                            Counter Affidavit Filed
                          </span>
                        </div>
                        <div className="p-3 rounded border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900">Regional GST Inspection Show-Cause Notice</span>
                            <p className="text-[11px] text-slate-500">Section 73 Notice • Reply window: 16 days remaining</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Reply Draft in QC
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Why Join Pilot Program Section */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Enterprise Pilot Cohort</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the In-House Legal Pilot?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Partner with Docketra to build an institutional legal operating system customized to your enterprise governance workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90d
              </span>
              <h3 className="text-sm font-bold text-slate-950">100% Free Full Enterprise Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted access for all in-house counsel, paralegals, and internal business requesters with unlimited matter dockets.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                02
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Data Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our legal ops engineers assist in importing existing litigation logs, contract inventories, and group subsidiary registers from Excel.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                03
              </span>
              <h3 className="text-sm font-bold text-slate-950">Dedicated Legal Ops Specialist</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct Slack/Teams channel with Docketra product engineers to configure custom matter taxonomies and intake approval hierarchies.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Interactive FAQ Accordion */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Frequently Asked Questions</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Everything You Need to Know About the In-House Pilot
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.id}
                  className={`rounded-md border transition-colors ${
                    isOpen ? 'border-slate-400 bg-white shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-4 flex items-center justify-between text-sm font-bold text-slate-950 select-none cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <span
                      className={`ml-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-amber-600' : ''
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Closing Conversion Banner */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200 text-center">
        <Container size="7xl">
          <div className="border border-slate-200 bg-white p-8 sm:p-10 rounded-lg max-w-4xl mx-auto space-y-3 shadow-xs">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Zero Financial Commitment • Limited Enterprise Cohort
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Bring Calm and Auditability to Your In-House Legal Ops
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Join legal leaders running high-velocity, risk-managed departments. Get full access for your entire legal team free for 90 days.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-colors hover:bg-slate-800 rounded-md"
              >
                <span>Start Your 3-Month Free Pilot →</span>
              </Link>
            </div>
            <p className="text-[11px] font-mono text-slate-500 pt-2">
              90 Days Free • Zero Financial Commitment • Indian Cloud Sovereignty • Dedicated Legal Ops Onboarding
            </p>
          </div>
        </Container>
      </section>

      {/* Shared Marketing Footer */}
      <MarketingFooter />
    </div>
  );
};

export default CorporateLegalTeamsSolutionPage;
