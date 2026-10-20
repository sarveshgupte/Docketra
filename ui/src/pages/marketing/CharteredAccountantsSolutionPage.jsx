import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicMarketingHeader from '../../components/marketing/PublicMarketingHeader';
import { MarketingFooter } from '../../components/landing/LandingPageContent';
import Container from '../../components/layout/Container';
import SeoHead from '../../components/common/SeoHead';

const FAQ_ITEMS = [
  {
    id: 'trainee-permissions',
    question: 'How do role-based permissions work for article trainees and audit staff?',
    answer:
      'Docketra provides strict Role-Based Access Control (RBAC) designed specifically for CA firms. Partners can scope article assistants, paid assistants, and audit seniors strictly to assigned client entities or specific workbaskets (e.g., GST or Statutory Audit). Trainees cannot access confidential partner billing rates, other partners\' clients, or submit final filings without mandatory partner sign-off.',
  },
  {
    id: 'data-residency-sovereignty',
    question: 'Where is client financial data stored and how is domestic data residency handled?',
    answer:
      'All client financial data, audit working papers, and tax documents are hosted exclusively on Tier-IV cloud infrastructure located physically within India (Mumbai and Hyderabad). We enforce TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. Furthermore, Docketra supports Bring-Your-Own-Storage (BYOS)—allowing your firm to vault working papers directly into your own firm\'s Google Drive or AWS S3 account with zero vendor lock-in.',
  },
  {
    id: 'unrestricted-data-export',
    question: 'Can we export our firm\'s complete data if we choose not to renew after the 3-month free pilot?',
    answer:
      'Yes, 100%. Docketra gives you complete data ownership with zero lock-in. You can export your entire client master list, historical docket audit trails, statutory registers, and work papers in clean Excel/CSV formats and organized ZIP archives anytime with a single click. We never hold your firm data hostage and charge zero export fees.',
  },
];

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

export const CharteredAccountantsSolutionPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState('tax');

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25 font-sans">
      <SeoHead
        canonicalPath="/solutions/chartered-accountants"
        title="Practice Management Software for Chartered Accountants | Docketra"
        description="Operating engine for high-velocity CA firms: tax filings, statutory audits, client dossiers, and automated task assignments. Claim 3 months free."
        jsonLd={FAQ_SCHEMA}
      />

      {/* Pilot Notification Eyebrow */}
      <div className="border-b border-amber-200/90 bg-amber-50/70 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            🚀 Docketra Pilot Cohort for CA Practices
          </span>
          <span className="text-slate-700 font-medium">
            3 Months Unrestricted Free Access • Pre-configured with Tax, Audit & GST Workbaskets
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim CA Pilot Seat →
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
              Built for Managing Partners & Audit Practice Heads
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              The Operating Engine for <span className="text-amber-600">High-Velocity CA Practices</span>
            </h1>

            <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-2xl mx-auto">
              Stop managing audit working papers, GST reconciliations, and tax scrutiny deadlines across WhatsApp threads and fragile spreadsheets. Run your entire firm on a unified, sovereign compliance workspace.
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
                <span>1-Click Excel client master import</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>Full access for all partners and audit trainees</span>
              </span>
            </div>
          </div>

          {/* Hero Visual Mockup */}
          <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* The Old CA Way */}
              <div className="rounded-md border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">The Fragmented CA Practice</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Excel + WhatsApp</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="rounded border border-rose-200/80 bg-white p-2.5 font-mono text-[11px]">
                    <span className="text-rose-700 font-bold">Tax_Audit_3CD_Status_v12.xlsx:</span> Clause 44 expenditure breakdown pending partner review.
                  </div>
                  <div className="rounded border border-rose-200/80 bg-white p-2.5">
                    <p className="text-slate-500 text-[11px] font-semibold mb-1">WhatsApp Message (Unlinked):</p>
                    <p className="italic text-slate-700">"Trainee sent revised GSTR-9 computation via chat. Which Excel version has final reconciliation?"</p>
                  </div>
                  <div className="rounded border border-rose-200/80 bg-rose-100/60 p-2 text-rose-800 text-[11px] font-medium">
                    Result: Partner signs without working paper audit trail. Revision scrutiny notice issued.
                  </div>
                </div>
              </div>

              {/* The Modern CA Way: Docketra */}
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">The Docketra Operating Engine</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 font-mono">Docketra CA</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-900 font-mono">DOCKET-2026-TAX-041</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-200 text-[10px]">Partner QC Signed</span>
                    </div>
                    <p className="text-slate-800 text-[11px] mt-1 font-medium">Shree Ganesh Logistics Pvt Ltd • Form 3CD Tax Audit</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-mono">PAN: AAGCS9281H • UDIN Generated • Working papers synced</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-[11px] font-semibold">4-Eye Partner Verification Gate Passed</p>
                      <p className="text-slate-500 text-[10px]">Clause 44 verified • Audit trail SQC-1 compliant</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 font-bold">100% Filed</span>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900 text-[11px] font-medium">
                    Result: Zero missed deadlines. Peer-review ready documentation. Calm audit season.
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Practice Reality Check</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              The Reality Check Matrix
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Tax deadlines and statutory audits cannot rely on memory. See why spreadsheets fail growing CA firms and how Docketra transforms operations.
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
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  <div className="p-4 sm:p-5 bg-rose-50/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5 font-mono">
                      <span>✕</span>
                      <span>{`The Fragile Way: ${item.legacy}`}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">
                      {item.legacyDetail}
                    </p>
                    <p className="text-[11px] font-medium text-rose-800">
                      Risk: {item.riskDetail}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-emerald-50/15">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5 font-mono">
                      <span>✓</span>
                      <span>{`The Docketra Way: ${item.docketra}`}</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {item.docketraDetail}
                    </p>
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Core Architecture</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Pillars of the Docketra CA Platform
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Engineered specifically for Indian Chartered Accountancy practices handling statutory audits, GST compliances, and direct tax scrutiny.
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
                The CA Partner Command Center
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Live practice telemetry: direct tax dockets, 4-eye review queues, and audit working records.
              </p>

              {/* Interactive Preview Tabs */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('tax')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'tax'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Tax & Audit Workbasket
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('qc')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'qc'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  4-Eye QC Gate
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('memory')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'memory'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Client Memory Dossier
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
                    docketra.in/app/firm/khanna-and-associates-ca
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  Live CA Firm Workspace
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'tax' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Tax Audit 3CD Matters</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">48 Engagements</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">100% on schedule</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Partner QC Sign-offs</p>
                        <p className="text-lg font-bold text-amber-700 mt-0.5">7 Returns Pending</p>
                        <p className="text-[10px] text-amber-800 mt-0.5">4-eye review gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Upcoming GSTR-9 Due Dates</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">32 Clients</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Auto-reconciliation ready</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Active CA Engagement Roster</span>
                        <span className="text-amber-700 font-mono text-[11px]">Filter: Direct Tax & Audit Baskets</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Shree Ganesh Logistics Private Limited</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">PAN: AAGCS9281H • Lead: Rahul (Article Senior)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              Form 3CD + 3CA
                            </span>
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                              Manager QC Passed
                            </span>
                          </div>
                        </div>
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Metropolis HealthCare Diagnostics LLP</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">GSTIN: 27AABCM8291F1Z8 • Lead: Priya (Associate)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              GSTR-9C Reconciliation
                            </span>
                            <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-mono">
                              Working Papers Uploaded
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'qc' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">4-Eye Partner QC Review Gate</span>
                        <span className="text-amber-800 font-mono text-[11px] font-bold">Strict Enforcement Active</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-4">
                        Returns cannot be marked 'Filed' or uploaded to IT/GST portals without partner inspection and signed audit working papers.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Reliance Polymers Ltd • ITR-6 Computation Review</p>
                            <p className="text-[11px] text-slate-500">Turnover: ₹84 Cr • 80-IA deduction verified • UDIN ready</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Awaiting Partner Sign-off
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Sunlight Engineering • GSTR-3B Aug 2026</p>
                            <p className="text-[11px] text-slate-500">ITC 2B Mismatch reconciled (Variance: ₹0)</p>
                          </div>
                          <span className="rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200 font-mono">
                            Partner QC Signed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'memory' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">Permanent Client Dossier & Working Papers</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold">Google Drive BYOS Connected</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Institutional memory preserved forever. When articles leave, past scrutiny orders, audit trails, and client files stay intact.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800">
                          AY 2024-25 Scrutiny (Sec 143(3))
                        </div>
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800">
                          26AS & AIS Audit Trails
                        </div>
                        <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                          ✓ 100% Files in Firm Storage
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Official CA Pilot Cohort</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the 3-Month Free Pilot?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Partner with Docketra to eliminate spreadsheet anxiety and run an audit-proof, calm compliance practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90d
              </span>
              <h3 className="text-sm font-bold text-slate-950">100% Free Full Firm Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted access for all partners, managers, article trainees, and paid assistants with unlimited clients and dockets.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                02
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Client Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our engineers validate and import your current Excel client lists, ongoing tax audit trackers, and staff assignments at zero cost.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                03
              </span>
              <h3 className="text-sm font-bold text-slate-950">Direct Founder & Product Hotline</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct WhatsApp and Slack access to Docketra product engineers to request custom tax schedules, audit checklists, and practice reports.
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
              Everything You Need to Know About the CA Pilot
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
              Zero Financial Commitment • Limited Pilot Cohort
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Upgrade Your CA Practice Ahead of the Next Filing Cycle
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Join forward-thinking CA practices running calm, audit-ready compliance. Start your 3-month pilot in under 5 minutes.
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
              3 Months Free • Zero Financial Commitment • Instant Excel Import • Dedicated CA Onboarding Specialist
            </p>
          </div>
        </Container>
      </section>

      {/* Shared Marketing Footer */}
      <MarketingFooter />
    </div>
  );
};

export default CharteredAccountantsSolutionPage;
