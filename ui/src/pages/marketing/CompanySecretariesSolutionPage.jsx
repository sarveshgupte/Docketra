import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../../components/common/SeoHead';

const FAQ_ITEMS = [
  {
    id: 'event-filings',
    question: 'How does Docketra support event-based MCA filings alongside regular annual compliance?',
    answer:
      'Docketra provides dedicated workflows for both annual cycles (AOC-4, MGT-7, DIR-3 KYC) and event-based filings under the Companies Act, 2013. Whether you are executing director appointments or resignations (DIR-12), charge creation or satisfaction (CHG-1/CHG-4), share capital alterations or allotments (PAS-3), or registered office shifting (INC-22), Docketra generates statutory checklists, triggers timeline alerts (e.g., 30-day ROC filing windows), tracks SRNs, and vaults all stamped receipts directly into the client\'s permanent record.',
  },
  {
    id: 'confidentiality-security',
    question: 'How is sensitive promoter and board confidentiality protected on Docketra?',
    answer:
      'We apply bank-grade security and strict data sovereignty standards. All data is hosted on Tier-IV cloud infrastructure located physically within India (Mumbai/Hyderabad). We enforce granular Role-Based Access Control (RBAC), multi-factor authentication, and end-to-end encryption in transit (TLS 1.3) and at rest (AES-256). Furthermore, Docketra supports Bring-Your-Own-Storage (BYOS)—meaning client documents and resolutions can be vaulted directly into your firm’s private Google Drive or AWS S3 bucket, ensuring zero third-party vendor lock-in.',
  },
  {
    id: 'data-export-guarantee',
    question: 'What happens to our client records if we decide not to renew after the 3-month free pilot?',
    answer:
      'Your firm owns 100% of its data with zero lock-in. At any point during or after the pilot, you can export your entire client master, docket histories, statutory registers, and audit logs in clean Excel/CSV formats and structured document archives with a single click. We never hold your data hostage, charge zero export fees, and if you connected your own storage (BYOS), your files remain safely in your firm\'s cloud.',
  },
];

const REALITY_CHECK_MATRIX = [
  {
    title: 'MCA Portal Juggling',
    pain: 'Spreadsheets & Portal Juggling',
    painDescription:
      'Frantic morning logins into MCA V3, manually tracking SRNs across scattered spreadsheets, missing additional fee windows, and zero real-time visibility into form approval or resubmission notices.',
    solution: 'Unified MCA & ROC Compliance Dashboard',
    solutionDescription:
      'Live compliance calendar with automated statutory clocks, automated alerts for pending filings, SLA countdowns, and direct SRN tracking across all 200+ client entities in one unified pane.',
    badge: 'Zero Late Fees',
  },
  {
    title: 'WhatsApp Draft Reviews',
    pain: 'Buried Resolutions & Missing Sign-offs',
    painDescription:
      'Draft board resolutions and MCA forms forwarded through chaotic WhatsApp chats and email threads. No immutable audit trail of who reviewed or approved the draft before government submission.',
    solution: 'Structured 4-Eye QC Review Baskets',
    solutionDescription:
      'Mandatory partner review gates. Senior CS partners inspect draft petitions, log revision notes, and grant immutable digital sign-offs before any filing goes out.',
    badge: '100% Audit-Proof',
  },
  {
    title: 'Annual Trainee Churn',
    pain: 'Institutional Memory Disappears',
    painDescription:
      'Article assistants and trainees leave every 12 to 24 months. Critical client memory, past board minutes, DSC PINs, and customized resolution templates walk out the door with them.',
    solution: 'Centralized Entity Client Memory',
    solutionDescription:
      'Every past board resolution, filing receipt, MCA challan, KYC record, and promoter communication is permanently bound to the client’s institutional workspace.',
    badge: 'Zero Brain Drain',
  },
  {
    title: 'Morning Status Panic',
    pain: '2 Hours Chasing Status Updates',
    painDescription:
      'Managing partners spend the first 2 hours of every day chasing associates on calls and WhatsApp asking: "Who is working on what? Which AGM notices went out? Did we file DIR-12?"',
    solution: 'Live PCS Command Center',
    solutionDescription:
      'Real-time operational telemetry across all clients. Instant visibility into open dockets, review bottlenecks, statutory deadlines due this week, and associate capacity.',
    badge: 'Instant Telemetry',
  },
];

const PILLARS = [
  {
    number: '01',
    title: 'Native Entity Intelligence',
    subtitle: 'DIN/DSC Registries & Statutory Registers',
    description:
      'Built specifically for Indian corporate entities. Automatically validates 21-digit CINs, tracks Director Identification Numbers (DINs) and Digital Signature Certificate (DSC) expirations, and generates statutory registers.',
    features: [
      '21-digit CIN validation with automatic ROC jurisdiction mapping',
      'DIN & DSC expiry countdowns with automated proactive director alerts',
      'Auto-populated statutory registers (Register of Members, Directors, Charges)',
      'Entity corporate structure and shareholding hierarchy mapping',
    ],
  },
  {
    number: '02',
    title: 'Statutory Compliance Dockets',
    subtitle: 'Companies Act, 2013 & MCA V3 Workflows',
    description:
      'Pre-configured compliance calendars and filing checklists for Companies Act annual requirements and event-driven filings. Never miss a statutory deadline or incur additional late fees.',
    features: [
      'Pre-built annual cycles: AOC-4, MGT-7/7A, DIR-3 KYC, DPT-3, MSME-1',
      'Event-based filing triggers: DIR-12, CHG-1/4, PAS-3, INC-22, SH-7',
      'Dynamic statutory countdown clocks with escalating late-fee warnings',
      'SRN status tracking with stamped challan and receipt vaulting',
    ],
  },
  {
    number: '03',
    title: 'Board Governance & Actionables',
    subtitle: 'From Notice to Minute Book & Resolutions',
    description:
      'Manage end-to-end secretarial governance for private, public, and section 8 companies. Keep your clients 100% compliant with SS-1 (Board Meetings) and SS-2 (General Meetings).',
    features: [
      'Board meeting notice generator and structured agenda builder',
      'Digital attendance registers and director quorum tracking',
      'Board resolution repository with taggable corporate secretarial templates',
      'Automated post-meeting action item tracking with assigned dockets',
    ],
  },
  {
    number: '04',
    title: 'Zero-Friction Excel & Copy-Paste Migration',
    subtitle: 'Onboard 200+ Clients in Under 15 Minutes',
    description:
      'Switch your entire firm from spreadsheets without manual re-entry. Docketra’s high-speed bulk ingestion engines parse, validate, and onboard your client master seamlessly.',
    features: [
      'Client Master Importer with dry-run CIN, PAN, and TAN format validation',
      'Direct copy-paste from Excel or Google Sheets with zero file conversion',
      'Historical docket & secretarial audit record migration templates',
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

export const CompanySecretariesSolutionPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState('mca');

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500/30 font-sans">
      <SeoHead
        canonicalPath="/solutions/company-secretaries"
        title="Practice Management Software for Company Secretaries | Docketra"
        description="Purpose-built secretarial practice management: MCA filings, ROC compliance calendar, 4-eye QC review, and automated client memory. Claim 3 months free."
        jsonLd={FAQ_SCHEMA}
      />
      {/* Pilot Notification Eyebrow */}
      <div className="sticky top-0 z-50 border-b border-amber-500/20 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 text-center text-xs sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 font-bold text-amber-400">
            🚀 Docketra Pilot Cohort for CS Practices
          </span>
          <span className="text-slate-300 font-medium">
            3 Months Unrestricted Free Access • Pre-built with MCA & Companies Act Workflows
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all"
          >
            Claim CS Pilot Seat →
          </Link>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white">
            <svg className="h-8 w-8 text-amber-500 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight">Docketra</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-0.5">The Company Brain</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-xs font-semibold text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-sm"
            >
              Join CS Pilot<span className="hidden sm:inline"> (3 Months Free)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-6">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Built for Practicing Company Secretaries (PCS) & Governance Teams
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
            The Operating System for Modern <span className="text-amber-400">Company Secretarial Practices</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Eliminate spreadsheet chaos across 200+ corporate clients. Centralize MCA deadlines, board resolutions, DIN/DSC registries, and statutory registers in one bulletproof workspace.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-7 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-lg shadow-amber-500/20"
            >
              Claim 3 Months Free Access →
            </Link>
            <a
              href="#preview"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white active:scale-[0.97] transition-all"
            >
              Explore Interactive Demo
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
              {"Instant onboarding with your firm's existing client list"}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Unrestricted seats for partners and trainees
            </span>
          </div>
        </div>

        {/* Hero Visual Mockup: PCS Operations Engine */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 sm:p-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* The Old CS Way */}
            <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-red-900/30 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">The Fragmented CS Practice</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Excel + WhatsApp</span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 font-mono text-[11px]">
                  <span className="text-red-400 font-bold">MCA_Deadlines_2025-26_v8.xlsx:</span> Form DIR-12 missed 30-day window due to cell sync lag.
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20">
                  <p className="text-slate-400 text-[11px] font-semibold mb-1">Trainee Query (Unindexed):</p>
                  <p className="italic text-slate-300">"Where did we save the signed board resolution for Nexus Infotech? Does Director Shah have a valid DSC token?"</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 text-red-300 text-[11px]">
                  Result: Partner spends 2 hours investigating. Additional late fees incurred. Defect notice issued.
                </div>
              </div>
            </div>

            {/* The Modern CS Way: Docketra */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">The Docketra Operating System</span>
                </div>
                <span className="text-[11px] font-bold text-amber-400">Docketra CS</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-amber-300">DOCKET-2026-MCA-142</span>
                    <span className="rounded bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 border border-emerald-800 text-[10px]">Partner QC Approved</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1 font-medium">Apex BioMed Limited • Form DIR-12 Appointment</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">CIN: U74999MH2019PLC321980 • SRN: F92817263 • DSC Verified</p>
                </div>
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-[11px] font-semibold">Statutory Register of Directors Auto-Updated</p>
                    <p className="text-slate-400 text-[10px]">Digital vault synced • Stamped challan verified</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">100% Filed</span>
                </div>
                <div className="rounded-lg bg-emerald-950/20 p-2 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  ✅ Result: Zero missed deadlines. Complete 4-eye audit trail. Total promoter confidence.
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
              Spreadsheet Chaos vs. Docketra CS Engine
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              The Reality Check Matrix
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Company secretarial compliance demands zero-defect precision. See why manual spreadsheets fail at scale and how Docketra transforms firm operations.
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
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
                  {/* The Old Way */}
                  <div className="p-6 bg-red-950/[0.04]">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                      <span>✕</span>
                      <span>{`The Old Way: ${item.pain}`}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {item.painDescription}
                    </p>
                  </div>
                  {/* The Docketra Way */}
                  <div className="p-6 bg-amber-500/[0.02]">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                      <span>✓</span>
                      <span>{`The Docketra Way: ${item.solution}`}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                      {item.solutionDescription}
                    </p>
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
              Core Architectural Capabilities
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Pillars of the Docketra CS Platform
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Engineered from the ground up for Indian corporate secretarial practices, combining deep statutory semantics with modern cloud architecture.
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
            <h2 className="text-xl sm:text-3xl font-extrabold text-white">
              The CS Practice Command Center
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Live telemetry: see how Docketra organizes client entity memory, MCA statutory clocks, and board governance.
            </p>

            {/* Interactive Preview Tabs */}
            <div className="mt-6 flex flex-wrap sm:inline-flex justify-center rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs gap-1 max-w-full">
              <button
                type="button"
                onClick={() => setActivePreviewTab('mca')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activePreviewTab === 'mca'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MCA & ROC Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('governance')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activePreviewTab === 'governance'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Board Governance Vault
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('migration')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activePreviewTab === 'migration'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Client Master Importer
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 sm:px-4 py-3 bg-slate-950/60 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex gap-1.5 shrink-0">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-1 sm:ml-2 font-mono text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-none">
                  docketra.in/app/firm/verma-cs-associates
                </span>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20 shrink-0 whitespace-nowrap">
                Live CS Workspace
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {activePreviewTab === 'mca' && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                      <p className="text-[11px] text-slate-400">Active MCA Dockets</p>
                      <p className="text-xl font-bold text-white mt-1">62 Filings</p>
                      <p className="text-[10px] text-emerald-400 mt-1">100% on schedule</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                      <p className="text-[11px] text-slate-400">Awaiting Partner Sign-Off</p>
                      <p className="text-xl font-bold text-amber-400 mt-1">8 Draft Petitions</p>
                      <p className="text-[10px] text-amber-400 mt-1">4-eye QC gate active</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                      <p className="text-[11px] text-slate-400">Upcoming DSC Expirations</p>
                      <p className="text-xl font-bold text-white mt-1">3 Directors</p>
                      <p className="text-[10px] text-slate-400 mt-1">Next: 28 days • Auto-alert sent</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-3">
                      <span>Client Compliance Roster</span>
                      <span className="text-amber-400 font-mono text-[11px]">Filter: MCA V3 Pending Filings</span>
                    </div>
                    <div className="divide-y divide-slate-800/80 text-xs">
                      <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-bold text-white">Quantum Robotics Private Limited</span>
                          <span className="ml-2 font-mono text-[10px] text-slate-400">CIN: U72900KA2022PTC159821</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                            Form DIR-12
                          </span>
                          <span className="rounded bg-emerald-950/80 text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-800">
                            SRN Generated
                          </span>
                        </div>
                      </div>
                      <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-bold text-white">Heritage Textiles and Logistics Limited</span>
                          <span className="ml-2 font-mono text-[10px] text-slate-400">CIN: L17120GJ1998PLC034567</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] font-mono border border-amber-500/20">
                            Form MGT-7
                          </span>
                          <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono">
                            QC Review
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'governance' && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">Board Meeting Governance and Resolution Vault</span>
                      <span className="text-emerald-400 font-mono text-[11px]">SS-1 Compliant</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed mb-4">
                      Notice issued with 7-day statutory period. Attendance register signed digitally. Agenda items mapped directly to statutory dockets.
                    </p>
                    <div className="space-y-2">
                      <div className="rounded-lg bg-slate-900 p-3 border border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-200">Resolution #BM-2026-04: Approval of Borrowing Limits (Sec 180)</p>
                          <p className="text-[11px] text-slate-400">Taggable template: Special Resolution • MGT-14 Required</p>
                        </div>
                        <span className="rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-1 border border-amber-500/20">
                          Draft Ready
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-900 p-3 border border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-200">Resolution #BM-2026-05: Appointment of Additional Director (Sec 161)</p>
                          <p className="text-[11px] text-slate-400">DIN: 08921734 • Consent in DIR-2 verified</p>
                        </div>
                        <span className="rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-1 border border-emerald-800">
                          Passed & Vaulted
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'migration' && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">Client Master Importer (Dry-Run Preview)</span>
                      <span className="text-emerald-400 font-mono text-[11px]">Validation 100% Passed</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed mb-3">
                      Uploaded: <span className="font-mono text-slate-300">CS_Client_Master_2026.xlsx</span> (214 rows processed)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
                        ✓ 214 Valid Entities
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                        0 Errors Detected
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        Ready to Provision
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Pilot Program Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Official CS Pilot Cohort</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Why Join the 3-Month Free Pilot?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              We are partnering with select Indian CS practices to establish the new gold standard for secretarial practice management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                90d
              </div>
              <h3 className="text-base font-bold text-white">100% Free Full Firm Workspace</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                90 days of unrestricted firm access for all partners, associates, and CS trainees with unlimited corporate clients and dockets.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                🤝
              </div>
              <h3 className="text-base font-bold text-white">White-Glove Migration</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Our engineers personally validate and import your current client spreadsheets, DIN/DSC trackers, and historical dockets at zero cost.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                ⚡
              </div>
              <h3 className="text-base font-bold text-white">Direct Founder & Product Hotline</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct WhatsApp and Slack access to Docketra product engineers to request custom compliance workflows and statutory form templates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Frequently Asked Questions</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Everything You Need to Know About the CS Pilot
            </h2>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border border-slate-800 transition-all ${
                    isOpen ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 hover:border-slate-700/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 flex items-center justify-between text-sm sm:text-base font-bold text-white select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <span
                      className={`ml-4 shrink-0 rounded-full border border-slate-700 p-1 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-amber-400' : ''
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing Conversion Banner */}
      <section className="border-t border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-4">
            Zero Financial Commitment • Limited Pilot Cohort
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Upgrade Your Secretarial Practice Today
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Join leading Indian PCS firms running modern, error-free corporate secretarial practices on Docketra.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-8 py-4 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-xl shadow-amber-500/20"
            >
              Claim 3 Months Free Access →
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            3 Months Free • Zero Financial Commitment • Instant Excel Import • Dedicated CS Onboarding Specialist
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
};
