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
      'Docketra provides strict Role-Based Access Control (RBAC) designed specifically for CA firms. Partners can scope article assistants, paid assistants, and audit seniors strictly to assigned client entities or specific workbaskets (e.g., GST or Statutory Audit). Trainees cannot access confidential partner billing rates, other partners’ clients, or submit final filings without mandatory partner sign-off.',
  },
  {
    id: 'data-residency-sovereignty',
    question: 'Where is client financial data stored and how is domestic data residency handled?',
    answer:
      'All client financial data, audit working papers, and tax documents are hosted exclusively on Tier-IV cloud infrastructure located physically within India (Mumbai and Hyderabad). We enforce TLS 1.3 encryption in transit, AES-256 encryption at rest, and zero third-party AI model training. Furthermore, Docketra supports Bring-Your-Own-Storage (BYOS)—allowing your firm to vault working papers directly into your own firm’s Google Drive or AWS S3 account with zero vendor lock-in.',
  },
  {
    id: 'unrestricted-data-export',
    question: 'Can we export our firm’s complete data if we choose not to renew after the 3-month free pilot?',
    answer:
      'Yes, 100%. Docketra gives you complete data ownership with zero lock-in. You can export your entire client master list, historical docket audit trails, statutory registers, and work papers in clean Excel/CSV formats and organized ZIP archives anytime with a single click. We never hold your firm data hostage and charge zero export fees.',
  },
];

const COMPARISON_ROWS = [
  {
    category: 'Tax & Audit Deadlines',
    feature: 'Filing Clocks & Penalty Shield',
    oldWay: 'Master Excel spreadsheets. Overwritten cells and missed windows cause penalties and Section 234 interest.',
    docketraWay: 'Automated statutory countdowns for Form 3CD, GSTR-9C, and ITR-6 with escalating partner alerts.',
    badge: 'Zero Missed Filings',
  },
  {
    category: 'Computation Reviews',
    feature: '4-Eye Partner QC Gates',
    oldWay: 'Draft computations and GSTR-3B summaries forwarded over WhatsApp; no formal review trail before filing.',
    docketraWay: 'Mandatory 4-eye QC review gate. Audit manager inspects and partner digitally signs before portal submission.',
    badge: '100% Quality Gate',
  },
  {
    category: 'Article Trainee Churn',
    feature: 'Institutional Client Memory',
    oldWay: 'Article clerks leave every 2–3 years. Working papers, trial balance notes, and computation history vanish.',
    docketraWay: 'Permanent client entity memory. Past computations, assessment orders (§143(3)), and audit trails stay permanently indexed.',
    badge: 'Zero Brain Drain',
  },
  {
    category: 'Audit Documentation',
    feature: 'ICAI SQC-1 Peer Review',
    oldWay: 'Working papers scattered across personal laptops and USB drives; panic during ICAI peer review inspection.',
    docketraWay: 'Centralized working paper repository with immutable audit trails meeting ICAI SQC-1 quality standards.',
    badge: 'Peer-Review Ready',
  },
  {
    category: 'Data Ownership',
    feature: 'Working Paper Storage (BYOS)',
    oldWay: 'Confidential client financials and audit files stored in personal folders or proprietary cloud databases.',
    docketraWay: 'Bring Your Own Storage (BYOS). All working papers save directly into your firm’s private Google Drive.',
    badge: '100% Firm Owned',
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
      <div className="border-b border-amber-200/90 bg-amber-50/80 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            ⚡ CA Pilot Cohort
          </span>
          <span className="text-slate-800 font-medium">
            3 Months Unrestricted Free Access for Chartered Accountants & Audit Firms
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim Free Pilot Seat →
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
              <span>Built for Managing Partners, Audit Leaders & Multi-Disciplinary Practices</span>
            </div>

            {/* Single H1 */}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl max-w-3xl mx-auto [text-wrap:balance] leading-[1.15]">
              Run your CA practice without <span className="text-amber-600">tax deadline panic</span> or missing working papers.
            </h1>

            {/* Concise Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Centralize Tax Audit (Form 3CD), GST reconciliations, 4-eye partner QC review, and article assistant tasks across 100 to 1,000+ corporate clients in one centralized cockpit.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-all hover:bg-slate-800 shadow-sm"
              >
                <span>Start 3-Month Free Pilot</span>
                <span>→</span>
              </Link>
              <a
                href="#comparison"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span>Compare vs. Excel & WhatsApp</span>
              </a>
            </div>

            {/* Quick Proof Pills */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Tax Audit & Clause 44 ready</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>4-Eye partner QC sign-off</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>SQC-1 audit trail compliance</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Private Google Drive (BYOS)</span>
              </span>
            </div>
          </div>

          {/* Graphic: CA Practice Operations Cockpit */}
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
                  Khanna & Associates (CA) • Live Practice Command Cockpit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  340 Corporate Clients Active
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                  Direct Tax • GST • Statutory Audit
                </span>
              </div>
            </div>

            {/* Top 3 Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Tax Audit 3CD Engagements</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                    0 Overdue
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">48 Active Matters</p>
                <p className="text-[11px] text-slate-600 mt-0.5">5 due this fortnight • Clause 44 verified</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>4-Eye Partner QC Queue</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded">
                    UDIN Ready
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">6 Pending Sign-Off</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Audit manager review completed</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>GST & ITC 2B Reconciliations</span>
                  <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1 rounded">
                    GSTR-9C Ready
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">82 Reconciled</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Zero variance • Working papers vaulted</p>
              </div>
            </div>

            {/* Live Engagement Pipeline Table Mockup */}
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
                <span>RECENT TAX & AUDIT ENGAGEMENTS</span>
                <span className="text-amber-700">ESC-ALERT: Section 44AB Statutory Cutoffs</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {/* Row 1 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Shree Ganesh Logistics Private Limited</span>
                      <span className="font-mono text-[10px] text-slate-500">PAN: AAGCS9281H</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Form 3CD + 3CA</span> • Tax Audit FY 2025-26 • Clause 44 Expenditure Breakdown Reconciled
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-500">UDIN: 26084921AAAA1234</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                      Partner QC Signed & Filed
                    </span>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Metropolis Healthcare Diagnostics LLP</span>
                      <span className="font-mono text-[10px] text-slate-500">GSTIN: 27AABCM8291F1Z8</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">GSTR-9C Reconciliation</span> • Annual GST Audit • ITC 2B vs Purchase Register Match
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ⏳ 8 Days Remaining
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800 border border-blue-200">
                      Working Papers Uploaded
                    </span>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Reliance Polymers Limited</span>
                      <span className="font-mono text-[10px] text-slate-500">PAN: AAACR1829K</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">ITR-6 Corporate Assessment</span> • Section 80-IA / MAT Computation • Trial Balance Locked
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-600">Turnover: ₹84 Cr</span>
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800 border border-purple-200">
                      Awaiting Partner Sign-off
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
              Why Spreadsheets Fail CA Practices
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Excel & WhatsApp vs. The Docketra CA Operating System
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              When your practice expands across hundreds of audits and tax clients, manual trackers break. Here is how Docketra shields your firm from missed deadlines and unreviewed returns.
            </p>
          </div>

          {/* Responsive Comparison Table */}
          <div className="max-w-5xl mx-auto overflow-hidden rounded-lg border border-slate-200 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-slate-700">
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider w-1/4">
                      CA Practice Area
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-rose-800 bg-rose-50/40 w-3/8">
                      Spreadsheets & WhatsApp (Old Way)
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50/40 w-3/8">
                      Docketra CA Platform (Modern Way)
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
              Purpose-Built for Indian Chartered Accountancy
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Everything Your CA Practice Needs in One Place
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Designed specifically for tax audits, statutory audits, GST compliances, and ICAI SQC-1 peer review readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {/* Bento Card 1: Tax Audit & 3CD Workflows */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 01</span>
                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                    Tax Audit Engine
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Tax Audit & Direct Tax Compliance Engine
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Pre-configured compliance calendars for Form 3CD, 3CA, 3CEB, and ITR-6/7. Automated Clause 44 expenditure breakdowns and statutory countdown clocks prevent Section 234 interest.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Form 3CD: Clause 44 Breakdown</span>
                  <span className="text-emerald-700">Verified</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Statutory Filing Window:</span>
                  <span className="font-bold text-slate-700">14 Days Remaining • ₹0 Penalty</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-4/5 rounded-full" />
                </div>
              </div>
            </div>

            {/* Bento Card 2: 4-Eye Partner QC Review Gates */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 02</span>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                    Partner Sign-Off
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  4-Eye Partner QC Review Gates
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Prevent unvetted returns from reaching income tax and GST portals. Enforce multi-tier digital sign-offs between article trainees, audit managers, and signing partners before UDIN generation.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Engagement: Reliance Polymers Ltd</span>
                  <span className="text-emerald-700 font-bold">Passed</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Audit Manager: Priya M.</span>
                  <span className="text-slate-700 font-medium">Signing Partner: S. Khanna</span>
                </div>
                <div className="text-[10px] text-emerald-800 font-semibold">
                  UDIN Generated • Immutable SQC-1 Audit Trail Logged
                </div>
              </div>
            </div>

            {/* Bento Card 3: GST & ITC 2B Reconciliations */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 03</span>
                  <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800">
                    GST Recon
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  GST & ITC 2B Reconciliation Vault
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Streamline monthly GSTR-3B filings and annual GSTR-9/9C audits. Automatically reconcile GSTR-2B against purchase ledgers, flag mismatched invoices, and preserve supporting working papers.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>GSTR-9C: Metropolis HealthCare</span>
                  <span className="text-blue-700 font-bold">100% Matched</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>ITC 2B vs Purchase Register:</span>
                  <span className="text-emerald-700 font-bold">Variance: ₹0</span>
                </div>
              </div>
            </div>

            {/* Bento Card 4: Permanent Client Memory & BYOS Drive */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 04</span>
                  <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800">
                    Zero Knowledge Loss
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Permanent Client Memory & BYOS Google Drive
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  When article assistants rotate out after their term, client trial balances, past assessment orders (§143(3)), and notes remain permanently bound to the client workspace in your firm’s private Google Drive.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Client Memory: 340 Dossiers Synced</span>
                  <span className="text-emerald-700 font-bold">Active</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Storage: Firm Private Google Drive</span>
                  <span className="text-slate-700 font-medium">AES-256 / BYOS</span>
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
                Explore the CA Practice Command Center
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Click the tabs below to preview the workflows your audit managers, partners, and article trainees will use daily.
              </p>

              {/* Tab Selector */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('tax')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'tax'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
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
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  4-Eye Partner QC Gate
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('memory')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'memory'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Client Memory Dossier
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
                    docketra.in/app/ca-firm/live-dashboard
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  CA Firm Engine
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'tax' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Tax Audit 3CD Matters</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">48 Engagements</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">100% on schedule</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Partner QC Sign-Offs</p>
                        <p className="text-lg font-bold font-mono text-amber-700 mt-0.5">6 Returns Pending</p>
                        <p className="text-[10px] text-amber-800 mt-0.5 font-medium">4-eye review gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">GSTR-9/9C Due Dates</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">32 Clients</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 font-medium">Reconciliations synced</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
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
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 font-mono">
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
                        <span className="text-amber-800 font-mono text-[11px] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Strict Enforcement Active
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Returns cannot be filed or marked complete without senior audit manager inspection, signed working papers, and partner digital approval.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Reliance Polymers Ltd • ITR-6 Computation Review</p>
                            <p className="text-[11px] text-slate-500 font-mono">Turnover: ₹84 Cr • Section 80-IA deduction verified • UDIN ready</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Awaiting Partner Sign-off
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Sunlight Engineering • GSTR-3B Aug 2026</p>
                            <p className="text-[11px] text-slate-500 font-mono">ITC 2B Mismatch reconciled (Variance: ₹0)</p>
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
                        <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Google Drive BYOS Connected
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Institutional memory preserved permanently. When article clerks complete their articleship, past assessment orders (§143(3)), computation sheets, and audit notes stay intact.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 font-medium">
                          AY 2024-25 Scrutiny (§143(3))
                        </div>
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 font-medium">
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

      {/* 3-Month Free CA Pilot Cohort Box */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600">
              Limited Pilot Cohort
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the 3-Month CA Pilot Program?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Partner with Docketra to eliminate spreadsheet anxiety and run a calm, audit-proof Chartered Accountancy practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90 DAYS FREE
              </span>
              <h3 className="text-sm font-bold text-slate-950">Full Firm Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted access for all partners, managers, article trainees, and paid assistants with unlimited clients and dockets.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                ASSISTED SETUP
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Excel Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our engineers validate and import your current Excel client lists, ongoing tax audit trackers, and staff assignments at zero cost.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                FOUNDER ACCESS
              </span>
              <h3 className="text-sm font-bold text-slate-950">Direct Product Priority</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct WhatsApp and phone line with Docketra’s product team to request custom tax schedules, audit checklists, and practice reports.
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
              Zero Financial Risk • 3-Month Free Pilot
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight [text-wrap:balance]">
              Upgrade your CA practice ahead of the next filing cycle.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Join leading Indian CA practices running structured, error-free compliance and audit management on Docketra. Onboard your firm in under 15 minutes.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-all hover:bg-slate-800 shadow-sm"
              >
                <span>Claim Your Free CA Pilot Seat →</span>
              </Link>
            </div>
            <div className="pt-2 text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-center gap-3">
              <span>✓ No credit card required</span>
              <span>•</span>
              <span>✓ Instant Excel client import</span>
              <span>•</span>
              <span>✓ 100% BYOS Google Drive</span>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
};

export default CharteredAccountantsSolutionPage;
