import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicMarketingHeader from '../../components/marketing/PublicMarketingHeader';
import { MarketingFooter } from '../../components/landing/LandingPageContent';
import Container from '../../components/layout/Container';
import SeoHead from '../../components/common/SeoHead';

const FAQ_ITEMS = [
  {
    id: 'event-filings',
    question: 'How does Docketra handle both annual and event-based MCA V3 filings?',
    answer:
      'Docketra tracks both annual cycles (AOC-4, MGT-7, DIR-3 KYC) and event-based corporate actions (DIR-12, CHG-1/4, PAS-3, INC-22). Every filing gets a 30-day statutory countdown clock, 4-eye partner sign-off, SRN tracking, and auto-vaulting of stamped ROC challans into the client’s permanent record.',
  },
  {
    id: 'confidentiality-security',
    question: 'Where are our client files and board resolutions stored? Can we use our Google Drive?',
    answer:
      'Yes. Docketra supports Bring Your Own Storage (BYOS). All client filings, signed resolutions, and ROC receipts can be vaulted directly into your firm’s private Google Drive or AWS S3 bucket. All metadata is hosted in India (Mumbai/Hyderabad) with TLS 1.3 and AES-256 encryption.',
  },
  {
    id: 'data-export-guarantee',
    question: 'What happens to our client data if we decide not to continue after the 3-month free pilot?',
    answer:
      'You own 100% of your data. You can export your entire client master, DIN/DSC registries, statutory registers, and filing histories to Excel/CSV with one click at any time. If you connected your Google Drive, your documents never leave your possession.',
  },
];

const COMPARISON_ROWS = [
  {
    category: 'MCA V3 Deadlines',
    feature: 'Filing Clocks & Late Fees',
    oldWay: 'Manual Excel sheets. Missed 30-day windows result in ₹100/day penalties and angry clients.',
    docketraWay: 'Automated 30-day statutory countdowns, escalating fee alerts, and live SRN status tracking.',
    badge: '₹100/day Shield',
  },
  {
    category: 'Physical DSC & DIN',
    feature: 'Director Token Registry',
    oldWay: 'Physical USB tokens lost in drawers. Unknown expiry dates. Deactivated DINs (₹5,000 fee).',
    docketraWay: 'Physical token location tracker (Locker/Drawer), 60-day expiry alerts, and DIR-3 KYC registry.',
    badge: 'Zero Expired DSCs',
  },
  {
    category: 'Board Governance',
    feature: 'SS-1 & SS-2 Compliance',
    oldWay: 'Word docs copy-pasted across clients. Forgotten 7-day notice rules and missing minutes books.',
    docketraWay: 'Pre-drafted resolution templates (§179, §180, §186), digital attendance, and instant MGT-14 triggers.',
    badge: 'SS-1 / SS-2 Ready',
  },
  {
    category: 'Trainee Churn',
    feature: 'Institutional Client Memory',
    oldWay: 'Article assistants leave every 1–2 years. Past filings, resolution history, and notes walk out the door.',
    docketraWay: 'Permanent client memory. Every past petition, challan, and partner note stays permanently bound to the entity.',
    badge: 'Zero Brain Drain',
  },
  {
    category: 'Data Ownership',
    feature: 'Document Storage (BYOS)',
    oldWay: 'Confidential client financials and minutes scattered across personal laptops and third-party servers.',
    docketraWay: 'Bring Your Own Storage (BYOS). All files save directly to your firm’s private Google Drive.',
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
        description="Purpose-built secretarial practice management: MCA V3 filings, ₹100/day late fee shield, DSC tracking, SS-1/SS-2 governance, and BYOS Google Drive storage."
        jsonLd={FAQ_SCHEMA}
      />

      {/* Pilot Notification Eyebrow */}
      <div className="border-b border-amber-200/90 bg-amber-50/80 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            ⚡ CS Pilot Cohort
          </span>
          <span className="text-slate-800 font-medium">
            3 Months Unrestricted Free Access for Practicing Company Secretaries (PCS)
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
              <span>Built for Practicing Company Secretaries (PCS) & Governance Teams</span>
            </div>

            {/* Single H1 */}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl max-w-3xl mx-auto [text-wrap:balance] leading-[1.15]">
              Run your CS practice without <span className="text-amber-600">MCA late fees</span> or spreadsheet chaos.
            </h1>

            {/* Concise Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Track MCA V3 filing clocks, physical DSC tokens, board governance (SS-1 & SS-2), and 4-eye partner reviews across 50 to 500+ corporate clients in one centralized cockpit.
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
                <span>₹100/day late fee shield</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Class-3 DSC & DIN vault</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>SS-1 & SS-2 secretarial standards</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Private Google Drive (BYOS)</span>
              </span>
            </div>
          </div>

          {/* Graphic: CS Operations Cockpit */}
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
                  Verma & Associates (PCS) • Live CS Command Cockpit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  184 Corporate Clients Active
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                  ROC: Mumbai / Delhi
                </span>
              </div>
            </div>

            {/* Top 3 Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>MCA V3 Filings Active</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                    0 Overdue
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">42 In Progress</p>
                <p className="text-[11px] text-slate-600 mt-0.5">3 due this week • ₹0 late fees incurred</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Class-3 DSC Token Vault</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded">
                    2 Expiring Soon
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">78 Tokens Tracked</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Physical location: Locker #2, Drawer B</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>4-Eye Partner QC Queue</span>
                  <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1 rounded">
                    Partner Sign-off
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-slate-950 mt-1 tabular-nums">4 Awaiting Review</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Mandatory review gate before MCA submission</p>
              </div>
            </div>

            {/* Live Filing Pipeline Table Mockup */}
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
                <span>RECENT MCA DOCKETS & GOVERNANCE PIPELINE</span>
                <span className="text-amber-700">ESC-ALERT: Active 30-Day Statutory Timers</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {/* Row 1 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Nexus Infotech Limited</span>
                      <span className="font-mono text-[10px] text-slate-500">CIN: U72900KA2021PLC048912</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Form DIR-12</span> • Appointment of Additional Director (§161) • Consent DIR-2 Verified
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-500">SRN: F94817291</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-200">
                      Partner Approved & Filed
                    </span>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Apex Health Diagnostics Pvt Ltd</span>
                      <span className="font-mono text-[10px] text-slate-500">CIN: U85110MH2018PTC309182</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Form AOC-4 & MGT-7</span> • FY 2025-26 Annual ROC Filing • Financials Tagged
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ⏳ 6 Days Remaining (₹0 Fee)
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800 border border-blue-200">
                      Draft in Partner QC
                    </span>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">Zenith Global Infra Limited</span>
                      <span className="font-mono text-[10px] text-slate-500">CIN: L45200DL2010PLC198273</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">SS-1 Board Meeting Notice</span> • Borrowing Limits (§180(1)(c)) • Special Resolution Drafted
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-600">7-Day Notice Dispatched</span>
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800 border border-purple-200">
                      MGT-14 Queued
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
              Why Spreadsheets Fail CS Firms
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Excel & WhatsApp vs. The Docketra CS Operating System
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              When your practice grows past 50 clients, manual tracking breaks. Here is how Docketra shields your firm from missed deadlines and unbilled work.
            </p>
          </div>

          {/* Responsive Comparison Table */}
          <div className="max-w-5xl mx-auto overflow-hidden rounded-lg border border-slate-200 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-slate-700">
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider w-1/4">
                      CS Practice Area
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-rose-800 bg-rose-50/40 w-3/8">
                      Spreadsheets & WhatsApp (Old Way)
                    </th>
                    <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50/40 w-3/8">
                      Docketra CS Platform (Modern Way)
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
              Purpose-Built for Indian Company Law
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Everything Your Secretarial Firm Needs in One Place
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Engineered specifically for the Companies Act, 2013 and MCA V3 workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {/* Bento Card 1: MCA V3 Automation */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 01</span>
                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                    MCA V3 Clocks
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  MCA V3 Filing Clocks & ₹100/Day Fee Shield
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Pre-configured compliance calendars for annual cycles (AOC-4, MGT-7, DPT-3, DIR-3 KYC) and event-based triggers (DIR-12, CHG-1/4, PAS-3, INC-22). Escalating countdown alerts ensure zero late fees.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>AOC-4 & MGT-7 Filing Clocks</span>
                  <span className="text-emerald-700">Active</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Statutory Deadline Countdown:</span>
                  <span className="font-bold text-slate-700">18 Days • ₹0 Fee</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-3/4 rounded-full" />
                </div>
              </div>
            </div>

            {/* Bento Card 2: Physical DSC & DIN Token Vault */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 02</span>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                    Hardware Vault
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Class-3 DSC Token & DIN KYC Tracker
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Never lose track of physical USB crypto tokens. Track which partner or associate holds the token (Locker #1, Drawer B, or Client Safe). Automated 60-day expiry notices prevent signing delays.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Director: Rajesh Singhania</span>
                  <span className="text-emerald-700 font-bold">Valid</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>DIN: 07821940 • Token: ePass2003</span>
                  <span className="text-slate-700 font-medium">Locker #2 / Drawer A</span>
                </div>
                <div className="text-[10px] text-amber-700 font-semibold">
                  DSC Expiry: 140 Days • DIR-3 KYC: Active
                </div>
              </div>
            </div>

            {/* Bento Card 3: Board Governance & Secretarial Standards */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 03</span>
                  <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800">
                    SS-1 & SS-2
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  Board Governance, Notices & Minute Book
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Keep clients 100% compliant with Secretarial Standards. Automated 7-day notice generator, quorum tracking, and pre-drafted resolutions for loans (§186), borrowings (§180), and banking operations.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Resolution §179: Bank Account Operation</span>
                  <span className="text-blue-700 font-bold">Standard</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Quorum: 3/4 Directors Signed</span>
                  <span className="text-emerald-700 font-bold">Minutes Vaulted</span>
                </div>
              </div>
            </div>

            {/* Bento Card 4: 5-Minute Excel Importer & BYOS Drive */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-amber-600">CAPABILITY 04</span>
                  <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800">
                    Zero Lock-In
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950 mb-1.5">
                  5-Minute Excel Import & BYOS Google Drive
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Copy-paste your 200+ clients straight from Excel with automatic CIN format validation. Connect your firm’s Google Drive so client files remain 100% in your private cloud with zero platform lock-in.
                </p>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span>Client Master: 214 Entities Parsed</span>
                  <span className="text-emerald-700 font-bold">100% Clean</span>
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
                Explore the CS Practice Command Center
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Click the tabs below to preview the workflows your associates and partners will use every day.
              </p>

              {/* Tab Selector */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('mca')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'mca'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  MCA V3 Compliance Radar
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
                  Board Governance & Minutes
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('migration')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activePreviewTab === 'migration'
                      ? 'bg-slate-950 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Excel Copy-Paste Importer
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
                    docketra.in/app/cs-firm/live-dashboard
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  PCS Practice Engine
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activePreviewTab === 'mca' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Active Filings</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">42 Dockets</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">100% on schedule</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Awaiting Partner Review</p>
                        <p className="text-lg font-bold font-mono text-amber-700 mt-0.5">4 Petitions</p>
                        <p className="text-[10px] text-amber-800 mt-0.5 font-medium">4-eye QC gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">DSC Expiry Warnings</p>
                        <p className="text-lg font-bold font-mono text-slate-950 mt-0.5">2 Directors</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 font-medium">Next: 28 days • Auto-alert dispatched</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Active Client Compliance Register</span>
                        <span className="text-amber-700 font-mono text-[11px]">Filter: MCA V3 30-Day Window</span>
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
                            <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 font-mono">
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
                              In Partner Review
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
                        <span className="font-bold text-slate-950 text-sm">Board Governance & Resolution Repository</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          SS-1 Compliant
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        Automated 7-day statutory notice dispatched. Digital attendance verified. Statutory draft resolutions ready for partner sign-off.
                      </p>
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Resolution #BM-2026-04: Approval of Borrowing Limits (§180)</p>
                            <p className="text-[11px] text-slate-500 font-mono">Special Resolution • Form MGT-14 Required</p>
                          </div>
                          <span className="rounded bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 font-mono">
                            Draft Ready
                          </span>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">Resolution #BM-2026-05: Appointment of Additional Director (§161)</p>
                            <p className="text-[11px] text-slate-500 font-mono">DIN: 08921734 • Consent in DIR-2 Verified</p>
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
                        <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Validation 100% Passed
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed mb-3">
                        File parsed: <span className="font-mono text-slate-900 font-bold">CS_Client_Master_2026.xlsx</span> (214 rows processed)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                          ✓ 214 Valid Entities
                        </div>
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                          0 Schema Errors
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

      {/* 3-Month Free CS Pilot Cohort Box */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600">
              Limited Pilot Cohort
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the 3-Month CS Pilot Program?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              We are working directly with leading Indian PCS firms to build the modern standard for corporate secretarial operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90 DAYS FREE
              </span>
              <h3 className="text-sm font-bold text-slate-950">Full Firm Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted access for all partners, associates, and trainees with unlimited corporate clients and dockets.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                ASSISTED SETUP
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Excel Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our engineering team validates and imports your existing client spreadsheets, DIN trackers, and historical dockets at zero cost.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-300 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                FOUNDER ACCESS
              </span>
              <h3 className="text-sm font-bold text-slate-950">Direct Product Priority</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct WhatsApp and phone line with Docketra’s core product team to request custom statutory workflows and resolution templates.
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
              Upgrade your secretarial practice today.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Join leading Indian CS practices running structured, error-free corporate compliance on Docketra. Onboard your firm in under 15 minutes.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-all hover:bg-slate-800 shadow-sm"
              >
                <span>Claim Your Free CS Pilot Seat →</span>
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

export default CompanySecretariesSolutionPage;
