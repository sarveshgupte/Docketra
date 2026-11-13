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
    question: "How does Docketra ensure data sovereignty and compliance with India's DPDP Act?",
    answer:
      'All customer data and documents are stored exclusively on Tier-IV cloud infrastructure located physically within India (Mumbai and Hyderabad). We enforce TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. In-house teams can also activate Bring-Your-Own-Storage (BYOS) to vault documents directly into their own enterprise AWS S3 or Google Drive buckets.',
  },
  {
    id: 'excel-migration',
    question: 'How straightforward is migrating ongoing litigation matters and contract repositories from Excel?',
    answer:
      'Migration takes minutes using Docketra’s built-in Matter & Entity Importers. You can upload existing spreadsheets containing active litigation, regulatory show-cause notices, contract registries, and subsidiary entity profiles. The system runs pre-flight dry runs, checks statutory identifiers (CIN, DIN, PAN), and auto-populates matter dockets with historical dates and responsible counsel.',
  },
];

const COMPARISON_ROWS = [
  {
    category: 'Legal Intake & Triage',
    feature: 'Front Door & SLA Tracking',
    oldWay: 'Drive-by Slack, WhatsApp, and email requests. Forgotten contracts, blown turnaround times, and zero paper trail.',
    docketraWay: 'Standardized legal front door. Automated queue triage, commercial priority tagging, and live SLA countdowns.',
    badge: 'Zero Dropped Requests',
  },
  {
    category: 'High-Value Contracts',
    feature: '4-Eye GC Approval Gates',
    oldWay: 'Commercial contracts signed without formal legal sign-off. High liability risks and unvetted indemnity clauses.',
    docketraWay: 'Mandatory 4-eye QC review gates for high-value contracts. Complete redline history and immutable GC sign-off.',
    badge: '100% Risk Defensibility',
  },
  {
    category: 'Regulatory Notices',
    feature: 'Statutory Notice Dockets',
    oldWay: 'Show-cause notices and labor summons scattered in local office folders; missed reply windows risk ex-parte orders.',
    docketraWay: 'Centralized regulatory matter dockets with statutory countdown clocks, counsel assignment, and escalation alerts.',
    badge: 'Zero Lapsed Deadlines',
  },
  {
    category: 'Outside Counsel',
    feature: 'Law Firm Spend & Milestones',
    oldWay: 'Opaque monthly law firm retainers. Duplicate research, ballooning legal spend, and unpredictable bills.',
    docketraWay: 'Milestone-driven docket tracking. Assign law firms with clear deliverable gates, hearing dates, and spend tracking.',
    badge: 'Spend Accountability',
  },
  {
    category: 'Data Sovereignty',
    feature: 'DPDP & Domestic Storage (BYOS)',
    oldWay: 'Confidential commercial contracts stored across personal drives and non-compliant third-party cloud tools.',
    docketraWay: '100% Indian data residency (Mumbai/Hyderabad). Bring Your Own Storage (BYOS) into enterprise Google Drive or S3.',
    badge: 'DPDP Act Ready',
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
      <div className="border-b border-amber-200/90 bg-amber-50/80 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            ⚡ Enterprise Legal Pilot
          </span>
          <span className="text-slate-800 font-medium">
            3 Months Unrestricted Free Access for In-House Legal Departments • Tier-IV Indian Data Residency
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim Enterprise Seat →
          </Link>
        </div>
      </div>

      {/* Navigation Header */}
      <PublicMarketingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50/50 pt-14 pb-12 sm:pt-18 sm:pb-16 border-b border-slate-200">
        <Container size="7xl">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-mono font-medium text-slate-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Built for General Counsel, Legal Ops Leaders & Corporate Secretaries</span>
            </div>

            {/* Single H1 */}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl max-w-3xl mx-auto [text-wrap:balance] leading-[1.15]">
              Total operational clarity for <span className="text-amber-600">in-house legal & compliance</span>.
            </h1>

            {/* Concise Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Replace drive-by Slack requests, unindexed contract drafts, and lost regulatory notices. Centralize internal legal intake, contract triage, outside counsel, and subsidiary governance in one reliable workspace.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-all hover:bg-slate-800 shadow-sm"
              >
                <span>Start 3-Month Enterprise Pilot</span>
                <span>→</span>
              </Link>
              <a
                href="#comparison"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span>Compare vs. Spreadsheets & Slack</span>
              </a>
            </div>

            {/* Quick Proof Pills */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Standardized legal front door</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>4-Eye GC approval gates</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Regulatory notice clocks</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Indian cloud residency (DPDP)</span>
              </span>
            </div>
          </div>

          {/* Graphic: Legal Operations Cockpit */}
          <div className="mx-auto mt-10 max-w-5xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            {/* Mockup Window Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700">
                  Titan Enterprises • In-House Legal Operations Cockpit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  14 Group Subsidiaries Active
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                  Domestic Cloud (Mumbai)
                </span>
              </div>
            </div>

            {/* Top 3 Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Internal Intake Queue</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                    98.4% SLA
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">18 Open Requests</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Avg turnaround: 22h • Zero unassigned</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>4-Eye High-Value Contracts</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded">
                    GC Review
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">4 Pending Sign-Off</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Threshold: &gt;₹1 Cr • Redlines verified</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Litigation & Regulatory Notices</span>
                  <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1 rounded">
                    Statutory Clocks
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">9 Active Matters</p>
                <p className="text-[11px] text-slate-600 mt-0.5">0 lapsed deadlines • Outside counsel linked</p>
              </div>
            </div>

            {/* Live Legal Pipeline Table Mockup */}
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
                <span>ACTIVE LEGAL INTAKE & REGULATORY MATTERS</span>
                <span className="text-amber-700">ESC-ALERT: Active Statutory Reply Windows</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {/* Row 1 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Enterprise Cloud Infrastructure Agreement</span>
                      <span className="font-mono text-[10px] text-slate-500">DOCKET-2026-LEG-088</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Commercial Contract</span> • ₹4.2 Cr Annual Value • Requester: Technology &amp; Security Ops
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-500">Turnaround: 22h</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                      GC Approved &amp; Executed
                    </span>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">NCLT Mumbai Bench: CP(IB) No. 412/MB/2026</span>
                      <span className="font-mono text-[10px] text-slate-500">Corporate Insolvency Defense</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Litigation Docket</span> • Designated Advocate: Senior Counsel Sh. M. Rao • Next Hearing: 14-Oct
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ⏳ 6 Days to Reply Window
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800 border border-blue-200">
                      Counter Affidavit in QC
                    </span>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Customer Data Processing Addendum (DPDP 2023)</span>
                      <span className="font-mono text-[10px] text-slate-500">Privacy &amp; Regulatory</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Compliance Advisory</span> • Requester: Product Engineering • Data Principal Rights Clause
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-600">SLA: 48h Tier</span>
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800 border border-purple-200">
                      Counsel Assigned
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Comparison Table Section */}
      <section id="comparison" className="py-16 bg-white border-b border-slate-200 scroll-mt-16">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600">
              Why Spreadsheets Fail Legal Operations
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Spreadsheets &amp; Slack vs. The Docketra Legal Operating System
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              When business demand accelerates across subsidiaries, ad-hoc legal intake breaks. Here is how Docketra shields your enterprise from blown contract SLAs and missed statutory windows.
            </p>
          </div>

          {/* Responsive Comparison Table */}
          <div className="max-w-5xl mx-auto overflow-hidden rounded-lg border border-slate-200 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-slate-700">
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider w-1/4">
                      Legal Practice Area
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-rose-800 bg-rose-50/40 w-3/8">
                      Spreadsheets &amp; Slack (Old Way)
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50/40 w-3/8">
                      Docketra Legal Platform (Modern Way)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900 align-top">
                        <div className="text-slate-950 font-bold">{row.feature}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{row.category}</div>
                      </td>
                      <td className="p-3.5 text-slate-600 bg-rose-50/15 align-top leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <span className="text-rose-600 font-bold shrink-0">✕</span>
                          <span>{row.oldWay}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-900 bg-emerald-50/15 align-top font-medium leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>{row.docketraWay}</span>
                        </div>
                        <span className="inline-block mt-1.5 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                          {row.badge}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>

      {/* 4 Core Capabilities Bento Grid */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Purpose-Built for Indian In-House Legal Departments
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Everything Your Legal Team Needs in One Place
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Engineered specifically for corporate legal intake, group subsidiary governance, high-value contract gates, and DPDP compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {/* Bento Card 1: Legal Intake & Triage */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 01</span>
                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                    Legal Front Door
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Structured Legal Intake &amp; Triage Portal
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Establish a single front door for commercial contracts, corporate advisory, and statutory sign-offs. Eliminate drive-by pings and centralize work in intelligent queues with automated SLA countdowns.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Intake SLA: High Priority Commercial</span>
                  <span className="text-emerald-700">On Track</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Turnaround Countdown:</span>
                  <span className="font-bold text-slate-700">18 Hours Remaining</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-4/5 rounded-full" />
                </div>
              </div>
            </div>

            {/* Bento Card 2: 4-Eye GC Review Gates */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 02</span>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                    Risk Safeguard
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  4-Eye GC Review Gates &amp; Redline Audit
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Ensure high-stakes commercial agreements, regulatory replies, and court affidavits pass rigorous dual-counsel review before execution. Complete redline history and immutable digital sign-offs.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Contract: Vendor MSA (&gt;₹1 Cr Threshold)</span>
                  <span className="text-emerald-700 font-bold">Passed</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Lead Counsel: Legal Manager</span>
                  <span className="text-slate-700 font-medium">Final Sign-off: General Counsel</span>
                </div>
                <div className="text-[10px] text-emerald-800 font-semibold">
                  Indemnity &amp; Limitation of Liability Verified
                </div>
              </div>
            </div>

            {/* Bento Card 3: Litigation & Regulatory Notices */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 03</span>
                  <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800">
                    Court &amp; Tribunal
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Regulatory Notice &amp; Litigation Docketing
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Track show-cause notices, tribunal hearings, outside counsel assignments, and statutory reply dates. Escalating reminders prevent missed court filing windows and ex-parte orders.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>NCLT Mumbai: CP(IB) 412/MB/2026</span>
                  <span className="text-blue-700 font-bold">Hearing 14-Oct</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Designated Advocate: Senior Counsel Sh. M. Rao</span>
                  <span className="text-emerald-700 font-bold">Affidavit Vaulted</span>
                </div>
              </div>
            </div>

            {/* Bento Card 4: Group Subsidiary Master & BYOS */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 04</span>
                  <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800">
                    DPDP &amp; BYOS
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Group Subsidiary Master &amp; BYOS Storage
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Manage corporate records, director DIN/DSC tokens, and statutory registers across group subsidiaries. Connect your enterprise Google Drive or AWS S3 with strict Indian data residency.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Subsidiaries: 14 Entities Synchronized</span>
                  <span className="text-emerald-700 font-bold">Compliant</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Storage: Enterprise Google Drive (BYOS)</span>
                  <span className="text-slate-700 font-medium">DPDP Tier-IV / Mumbai</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Interactive Command Center Preview */}
      <section id="preview" className="py-16 bg-white border-b border-slate-200 scroll-mt-16">
        <Container size="7xl">
          <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
                Interactive Preview
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                Explore the General Counsel Command Center
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Click the tabs below to preview the workflows your in-house counsel, paralegals, and business stakeholders will use daily.
              </p>

              {/* Tab Selector */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('intake')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'intake'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Intake &amp; Triage Front Door
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('governance')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'governance'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
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
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Litigation &amp; Notice Dockets
                </button>
              </div>
            </div>

            {/* Simulated Workspace View */}
            <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-slate-50 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-slate-500 truncate">
                    docketra.in/app/legal/titan-enterprises
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  Corporate Legal Engine
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'intake' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Active Requests in Queue</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">18 Open</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">Avg SLA: 24h turnaround</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">4-Eye Approvals Pending</p>
                        <p className="text-lg font-bold font-mono text-amber-700 mt-0.5">4 Contracts</p>
                        <p className="text-[10px] text-amber-800 mt-0.5 font-medium">GC review gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">SLA Compliance Rate</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">98.4%</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 font-medium">Top quartile velocity</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
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
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 font-mono">
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
                              Privacy &amp; Regulatory
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
                        <span className="font-bold text-slate-950 text-sm">Group Entity &amp; Subsidiary Roster</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          14 Subsidiaries • All Compliant
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Direct synchronization of director DINs, DSC tokens, and corporate resolutions across holding and operating entities.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Titan Digital Technologies Private Limited</p>
                            <p className="text-[11px] text-slate-500 font-mono">CIN: U72900MH2021PTC368291 • 4 Directors • PoA Registry Active</p>
                          </div>
                          <span className="rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200 font-mono">
                            100% Up-to-Date
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Titan Logistics &amp; Supply Chain Limited</p>
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
                        <span className="font-bold text-slate-950 text-sm">Regulatory Notice &amp; Litigation Docketing</span>
                        <span className="text-amber-800 font-mono text-[11px] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Statutory Clocks Active
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Track show-cause notices, tribunal hearings, outside counsel assignments, and statutory reply dates.
                      </p>
                      <div className="space-y-2">
                        <div className="p-3 rounded border border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-semibold text-slate-900">NCLT Mumbai Bench: CP(IB) No. 412/MB/2026</span>
                            <p className="text-[11px] text-slate-500 font-mono">Designated Advocate: Senior Counsel Sh. M. Rao • Next Hearing: 14-Oct</p>
                          </div>
                          <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-0.5">
                            Counter Affidavit Filed
                          </span>
                        </div>
                        <div className="p-3 rounded border border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-semibold text-slate-900">Regional GST Inspection Show-Cause Notice</span>
                            <p className="text-[11px] text-slate-500 font-mono">Section 73 Notice • Reply window: 16 days remaining</p>
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

      {/* 3-Month Free Enterprise Pilot Cohort Box */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600">
              Limited Enterprise Cohort
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the In-House Legal Pilot?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Partner with Docketra to build an institutional legal operating system customized to your enterprise governance workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90 DAYS FREE
              </span>
              <h3 className="text-sm font-bold text-slate-950">Full Enterprise Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted access for all in-house counsel, paralegals, and internal business requesters with unlimited matter dockets.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                ASSISTED SETUP
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Data Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our legal ops engineers assist in importing existing litigation logs, contract inventories, and group subsidiary registers from Excel.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                DIRECT PRIORITY
              </span>
              <h3 className="text-sm font-bold text-slate-950">Dedicated Legal Ops Specialist</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct Slack/Teams channel with Docketra product engineers to configure custom matter taxonomies and intake approval hierarchies.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Clear Answers
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border transition-colors ${
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

      {/* Closing Call to Action */}
      <section className="py-16 bg-slate-50/50 border-b border-slate-200 text-center">
        <Container size="7xl">
          <div className="border border-slate-200 bg-white p-8 sm:p-10 rounded-xl max-w-3xl mx-auto space-y-4 shadow-sm">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600">
              Zero Financial Risk • 3-Month Enterprise Pilot
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight [text-wrap:balance]">
              Bring calm and auditability to your in-house legal ops.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Join legal leaders running high-velocity, risk-managed departments. Get full access for your entire legal team free for 90 days.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-all hover:bg-slate-800 shadow-sm"
              >
                <span>Claim Your Free Enterprise Seat →</span>
              </Link>
            </div>
            <div className="pt-2 text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-center gap-3">
              <span>✓ No credit card required</span>
              <span>•</span>
              <span>✓ Instant Excel matter import</span>
              <span>•</span>
              <span>✓ 100% BYOS Google Drive / S3</span>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
};

export default CorporateLegalTeamsSolutionPage;
