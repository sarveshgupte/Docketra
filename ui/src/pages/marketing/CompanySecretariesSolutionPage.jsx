import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicMarketingHeader from '../../components/marketing/PublicMarketingHeader';
import { MarketingFooter } from '../../components/landing/LandingPageContent';
import Container from '../../components/layout/Container';
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
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25 font-sans">
      <SeoHead
        canonicalPath="/solutions/company-secretaries"
        title="Practice Management Software for Company Secretaries | Docketra"
        description="Purpose-built secretarial practice management: MCA filings, ROC compliance calendar, 4-eye QC review, and automated client memory. Claim 3 months free."
        jsonLd={FAQ_SCHEMA}
      />

      {/* Pilot Notification Eyebrow */}
      <div className="border-b border-amber-200/90 bg-amber-50/70 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            🚀 Docketra Pilot Cohort for CS Practices
          </span>
          <span className="text-slate-700 font-medium">
            3 Months Unrestricted Free Access • Pre-built with MCA & Companies Act Workflows
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim CS Pilot Seat →
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
              Built for Practicing Company Secretaries (PCS) & Governance Teams
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              The Operating System for Modern <span className="text-amber-600">Company Secretarial Practices</span>
            </h1>

            <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-2xl mx-auto">
              Eliminate spreadsheet chaos across 200+ corporate clients. Centralize MCA deadlines, board resolutions, DIN/DSC registries, and statutory registers in one bulletproof workspace.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800 rounded-md"
              >
                <span>Claim 3 Months Free Access</span>
                <span>→</span>
              </Link>
              <a
                href="#preview"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors rounded-md"
              >
                <span>Explore Interactive Demo</span>
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
                <span>{"Instant onboarding with your firm's existing client list"}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>Unrestricted seats for partners and trainees</span>
              </span>
            </div>
          </div>

          {/* Hero Visual Mockup */}
          <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* The Old CS Way */}
              <div className="rounded-md border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">The Fragmented CS Practice</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Excel + WhatsApp</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="rounded border border-rose-200/80 bg-white p-2.5 font-mono text-[11px]">
                    <span className="text-rose-700 font-bold">MCA_Deadlines_2025-26_v8.xlsx:</span> Form DIR-12 missed 30-day window due to cell sync lag.
                  </div>
                  <div className="rounded border border-rose-200/80 bg-white p-2.5">
                    <p className="text-slate-500 text-[11px] font-semibold mb-1">Trainee Query (Unindexed):</p>
                    <p className="italic text-slate-700">"Where did we save the signed board resolution for Nexus Infotech? Does Director Shah have a valid DSC token?"</p>
                  </div>
                  <div className="rounded border border-rose-200/80 bg-rose-100/60 p-2 text-rose-800 text-[11px] font-medium">
                    Result: Partner spends 2 hours investigating. Additional late fees incurred. Defect notice issued.
                  </div>
                </div>
              </div>

              {/* The Modern CS Way: Docketra */}
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">The Docketra Operating System</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 font-mono">Docketra CS</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-900 font-mono">DOCKET-2026-MCA-142</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-200 text-[10px]">Partner QC Approved</span>
                    </div>
                    <p className="text-slate-800 text-[11px] mt-1 font-medium">Apex BioMed Limited • Form DIR-12 Appointment</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-mono">CIN: U74999MH2019PLC321980 • SRN: F92817263 • DSC Verified</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-[11px] font-semibold">Statutory Register of Directors Auto-Updated</p>
                      <p className="text-slate-500 text-[10px]">Digital vault synced • Stamped challan verified</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 font-bold">100% Filed</span>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900 text-[11px] font-medium">
                    Result: Zero missed deadlines. Complete 4-eye audit trail. Total promoter confidence.
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Spreadsheet Chaos vs. Docketra CS Engine</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              The Reality Check Matrix
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Company secretarial compliance demands zero-defect precision. See why manual spreadsheets fail at scale and how Docketra transforms firm operations.
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
                      <span>{`The Old Way: ${item.pain}`}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.painDescription}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-emerald-50/15">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5 font-mono">
                      <span>✓</span>
                      <span>{`The Docketra Way: ${item.solution}`}</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {item.solutionDescription}
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Core Architectural Capabilities</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Pillars of the Docketra CS Platform
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Engineered from the ground up for Indian corporate secretarial practices, combining deep statutory semantics with modern cloud architecture.
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
                The CS Practice Command Center
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Live telemetry: see how Docketra organizes client entity memory, MCA statutory clocks, and board governance.
              </p>

              {/* Interactive Preview Tabs */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('mca')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'mca'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  MCA & ROC Telemetry
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
                  Board Governance Vault
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('migration')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'migration'
                      ? 'bg-slate-950 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Client Master Importer
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
                    docketra.in/app/firm/verma-cs-associates
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  Live CS Workspace
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'mca' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Active MCA Dockets</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">62 Filings</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">100% on schedule</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Awaiting Partner Sign-Off</p>
                        <p className="text-lg font-bold text-amber-700 mt-0.5">8 Draft Petitions</p>
                        <p className="text-[10px] text-amber-800 mt-0.5">4-eye QC gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Upcoming DSC Expirations</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">3 Directors</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Next: 28 days • Auto-alert sent</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Client Compliance Roster</span>
                        <span className="text-amber-700 font-mono text-[11px]">Filter: MCA V3 Pending Filings</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Quantum Robotics Private Limited</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">CIN: U72900KA2022PTC159821</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              Form DIR-12
                            </span>
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                              SRN Generated
                            </span>
                          </div>
                        </div>
                        <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">Heritage Textiles and Logistics Limited</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">CIN: L17120GJ1998PLC034567</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-mono border border-amber-200">
                              Form MGT-7
                            </span>
                            <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-mono">
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
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">Board Meeting Governance and Resolution Vault</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold">SS-1 Compliant</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-4">
                        Notice issued with 7-day statutory period. Attendance register signed digitally. Agenda items mapped directly to statutory dockets.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Resolution #BM-2026-04: Approval of Borrowing Limits (Sec 180)</p>
                            <p className="text-[11px] text-slate-500">Taggable template: Special Resolution • MGT-14 Required</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Draft Ready
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Resolution #BM-2026-05: Appointment of Additional Director (Sec 161)</p>
                            <p className="text-[11px] text-slate-500">DIN: 08921734 • Consent in DIR-2 verified</p>
                          </div>
                          <span className="rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200 font-mono">
                            Passed & Vaulted
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'migration' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-950 text-sm">Client Master Importer (Dry-Run Preview)</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold">Validation 100% Passed</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Uploaded: <span className="font-mono text-slate-800">CS_Client_Master_2026.xlsx</span> (214 rows processed)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                          ✓ 214 Valid Entities
                        </div>
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                          0 Errors Detected
                        </div>
                        <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                          Ready to Provision
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
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Official CS Pilot Cohort</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the 3-Month Free Pilot?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              We are partnering with select Indian CS practices to establish the new gold standard for secretarial practice management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90d
              </span>
              <h3 className="text-sm font-bold text-slate-950">100% Free Full Firm Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted firm access for all partners, associates, and CS trainees with unlimited corporate clients and dockets.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                02
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our engineers personally validate and import your current client spreadsheets, DIN/DSC trackers, and historical dockets at zero cost.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                03
              </span>
              <h3 className="text-sm font-bold text-slate-950">Direct Founder & Product Hotline</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct WhatsApp and Slack access to Docketra product engineers to request custom compliance workflows and statutory form templates.
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
              Everything You Need to Know About the CS Pilot
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
              Upgrade Your Secretarial Practice Today
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Join leading Indian PCS firms running modern, error-free corporate secretarial practices on Docketra.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-colors hover:bg-slate-800 rounded-md"
              >
                <span>Claim 3 Months Free Access →</span>
              </Link>
            </div>
            <p className="text-[11px] font-mono text-slate-500 pt-2">
              3 Months Free • Zero Financial Commitment • Instant Excel Import • Dedicated CS Onboarding Specialist
            </p>
          </div>
        </Container>
      </section>

      {/* Shared Marketing Footer */}
      <MarketingFooter />
    </div>
  );
};

export default CompanySecretariesSolutionPage;
