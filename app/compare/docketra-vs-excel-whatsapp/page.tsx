import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docketra vs Excel & WhatsApp | 3-Month Free Pilot for Indian Compliance Firms',
  description: 'Outgrow spreadsheet chaos and lost WhatsApp files. Switch to Docketra in minutes with built-in Excel/CSV importers and claim a 3-month free pilot.',
};

const FAQ_ITEMS = [
  {
    question: 'What is included in the 3-month free pilot?',
    answer:
      'The 3-month pilot provides complete, unrestricted firm-wide access for all partners, associates, and trainees. You get unlimited client entities, dockets, automated MCA/ROC/tax calendar tracking, 4-eye QC review gates, BYOS Google Drive integration, and dedicated 1-on-1 onboarding support with zero setup fees and no credit card required.',
  },
  {
    question: 'How hard is it to migrate our existing client spreadsheet?',
    answer:
      'Switching takes minutes. Docketra features a built-in Client Master Importer with dry-run validation for CIN, PAN, GSTIN, and TAN formats. You can either upload your existing CSV/Excel file or copy-paste tab-separated cells directly from spreadsheets. Any invalid rows generate an error report with exact line numbers for instant resolution.',
  },
  {
    question: 'How does Docketra handle Indian statutory formats?',
    answer:
      'Docketra is engineered specifically for Indian compliance practices. It natively validates 21-digit Corporate Identification Numbers (CIN), 10-digit PAN/TAN, 15-digit GSTIN, and DINs. It organizes MCA V3 annual filings (AOC-4, MGT-7), secretarial audits, board resolutions, and tax due dates into structured dockets with automatic statutory alerts.',
  },
  {
    question: 'How does Docketra compare to generic tools like ClickUp, Notion, or Asana?',
    answer:
      'Generic tools lack Indian statutory semantics—they have no concept of a CIN, 4-eye partner sign-offs, statutory filing penalties, or MCA compliance calendars. Setting them up requires months of custom consulting. Docketra is purpose-built and ready on day one with compliance workbaskets, client memory, and audit trails tailored for Indian CA and CS practices.',
  },
  {
    question: 'Where is our client data stored and how is it secured?',
    answer:
      'We operate on enterprise-grade Indian cloud infrastructure ensuring data sovereignty. Furthermore, Docketra supports Bring-Your-Own-Storage (BYOS), allowing your client documents to be stored directly inside your own firm’s Google Drive or AWS S3 account with client-level folder isolation and zero vendor lock-in.',
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

const COMPARISON_DATA = [
  {
    feature: 'Statutory Deadline Tracking',
    excel: 'Static dates manually typed into cells. Easily missed when MCA or CBDT extends deadlines or when sheets aren\'t refreshed.',
    docketra: 'Dynamic MCA/ROC & Tax compliance calendar with automated statutory alerts, SLA countdowns, and late-fee prevention.',
  },
  {
    feature: 'Quality Control & Sign-offs',
    excel: 'Chaos across WhatsApp groups and email chains. No audit trail of who approved the draft petition or return before government submission.',
    docketra: 'Structured 4-eye QC Review Baskets. Senior partners inspect drafts, log revision notes, and grant immutable digital sign-offs.',
  },
  {
    feature: 'Staff & Trainee Turnover',
    excel: 'Institutional memory vanishes when an article assistant leaves. Files remain trapped in local downloads, personal drives, or private chats.',
    docketra: 'Persistent Entity Client Memory. Every past resolution, filing receipt, KYC document, and note stays bound to the firm’s permanent workspace.',
  },
  {
    feature: 'Partner Visibility & Queue Health',
    excel: 'Morning status panic ("Who is working on what?"). Partners spend 2 hours daily chasing team members on WhatsApp for routine updates.',
    docketra: 'Live Partner Command Center. Real-time telemetry on active dockets, review bottlenecks, capacity allocation, and upcoming statutory gates.',
  },
  {
    feature: 'Data Sovereignty & Security',
    excel: 'Unencrypted client PANs, DSC PINs, and draft resolutions shared in casual WhatsApp groups with zero access controls.',
    docketra: 'Tier-IV Indian Cloud Infrastructure with RBAC, immutable audit logging, and BYOS (Bring Your Own Storage) into firm Google Drive.',
  },
];

export default function DocketraVsExcelWhatsAppPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500/30 font-sans">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      {/* Top Eyebrow Pilot Banner */}
      <div className="sticky top-0 z-50 border-b border-amber-500/20 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 text-center text-xs sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 font-bold text-amber-400">
            🚀 Docketra Pilot Cohort Open
          </span>
          <span className="text-slate-300 font-medium">
            Exclusive for Indian CS, CA & Corporate Legal Practices • 3 Months Free Access • 0 Setup Fees
          </span>
          <a
            href="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Claim Pilot Seat →
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
              Join Pilot (3 Months Free)
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-6">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Comparison Guide • Built for Indian Compliance Practitioners
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
            The Hidden Cost of Managing Indian Compliance on{' '}
            <span className="bg-gradient-to-r from-red-400 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Excel & WhatsApp
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Why leading corporate secretarial and legal practices outgrow spreadsheets—and how modern firms build an
            institutional brain that never forgets a statutory deadline or client document.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="/signup"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-lg shadow-amber-500/20"
            >
              Join Pilot (3 Months Free) →
            </a>
            <a
              href="#sandbox-preview"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white active:scale-[0.97] transition-all"
            >
              Explore Interactive Sandbox
            </a>
          </div>

          {/* Risk-Reversal Subtext */}
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
              Full workspace access
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              1-Click Excel data import
            </span>
          </div>
        </div>

        {/* Visual Comparison Mockup Banner */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 sm:p-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* The Old Way: Spreadsheets & WhatsApp */}
            <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-red-900/30 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">The Fragmented Way</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Excel + WhatsApp</span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 font-mono text-[11px]">
                  <span className="text-red-400 font-bold">❌ Client Tracker_v14_final.xlsx:</span> Row 48 cell edited 12 days ago without alert.
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20">
                  <p className="text-slate-400 text-[11px] font-semibold mb-1">WhatsApp Group "Acme Compliance":</p>
                  <p className="italic text-slate-300">"Sir, where is the DIN KYC OTP? Did we file AOC-4 yesterday? Who has DSC PIN?"</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-red-900/20 text-red-300 text-[11px]">
                  ⚠️ Result: Partner spends 3 hours chasing files. Filing delayed. ROC late fees applied.
                </div>
              </div>
            </div>

            {/* The Modern Way: Docketra */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">The Modern Operating System</span>
                </div>
                <span className="text-[11px] font-bold text-amber-400">Docketra</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-amber-300">DOCKET-2026-MCA-089</span>
                    <span className="rounded bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 border border-emerald-800 text-[10px]">QC Approved</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1 font-medium">Acme FinTech Ltd • MCA Form AOC-4 Filing</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">CIN: U72200MH2021PTC368291 • Due in 4 days • Auto-alert active</p>
                </div>
                <div className="rounded-lg bg-slate-900/90 p-2.5 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-[11px] font-semibold">4-Eye Partner Gate Passed</p>
                    <p className="text-slate-400 text-[10px]">Signed off by Managing Partner (Audit log #3829)</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">100% Ready</span>
                </div>
                <div className="rounded-lg bg-emerald-950/20 p-2 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  ✅ Result: Zero missed deadlines. Instant partner visibility. Audit trail preserved.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Matrix Section */}
      <section className="border-t border-slate-800/90 bg-slate-900/40 py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">The Cold Reality</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Excel & WhatsApp vs. Docketra
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              See why spreadsheets break as soon as your firm handles more than 25 corporate entities.
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-bold">
                  <th className="py-4 px-6 text-slate-400 w-1/4">Practice Area</th>
                  <th className="py-4 px-6 text-red-400 w-3/8 bg-red-950/10 border-r border-slate-800">
                    Excel & WhatsApp (The Fragile Stack)
                  </th>
                  <th className="py-4 px-6 text-amber-400 w-3/8 bg-amber-500/5">
                    Docketra (The Company Brain)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
                {COMPARISON_DATA.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-white align-top">
                      {row.feature}
                    </td>
                    <td className="py-4 px-6 text-slate-400 bg-red-950/[0.04] border-r border-slate-800 align-top leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                        <span>{row.excel}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-200 bg-amber-500/[0.02] align-top leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                        <span className="font-medium text-slate-100">{row.docketra}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {COMPARISON_DATA.map((row, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                  {row.feature}
                </h4>
                <div className="rounded-lg bg-red-950/20 border border-red-900/30 p-3 text-xs text-red-200">
                  <p className="font-bold text-red-400 mb-1">Excel & WhatsApp:</p>
                  <p className="leading-relaxed">{row.excel}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">
                  <p className="font-bold text-amber-400 mb-1">Docketra:</p>
                  <p className="leading-relaxed">{row.docketra}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The 4 Breaking Points Deep Dive */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Root-Cause Analysis</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              The 4 Breaking Points of Unstructured Practice Operations
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Why adding more spreadsheets and WhatsApp groups only accelerates chaos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 hover:border-slate-700 transition-all">
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 mb-4">
                Feature: Client Memory
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2">
                1. "The Senior Partner Becomes an Internal Search Engine"
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                When entity knowledge lives in chat threads, partners spend 30% of their workday answering associate questions:
                <em className="text-slate-400 block mt-1">"Who is the authorized signatory for XYZ Corp? Did we file form DIR-12 last quarter? Where is the signed MOA?"</em>
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-400">
                <span className="font-bold text-amber-400">The Docketra Fix:</span> Institutional Client Memory. Every entity’s master data (CIN, DIN, PAN, registered office, statutory records, past resolutions) is indexed and searchable across the entire firm in 1 click.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 hover:border-slate-700 transition-all">
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 mb-4">
                Feature: Review Gates
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2">
                2. "QC Reviews Disappear into WhatsApp Noise"
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Draft forms, board resolutions, and tax returns are dropped into WhatsApp groups for review. Amid 80 other notifications, they get lost. Submissions occur without formal partner sign-off until an ROC defect notice or penalty letter arrives.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-400">
                <span className="font-bold text-amber-400">The Docketra Fix:</span> 4-Eye Review Gates. Dockets cannot advance to filing until assigned managers or partners approve the work in dedicated QC Baskets with complete revision history.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 hover:border-slate-700 transition-all">
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 mb-4">
                Feature: Firm-Owned Worklists
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2">
                3. "Institutional Brain Drain on Staff Exit"
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Article assistants and junior associates rotate every 12 to 24 months. When an associate leaves, client draft files on their personal laptops, pending form checklists, and WhatsApp message context walk out the door with them.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-400">
                <span className="font-bold text-amber-400">The Docketra Fix:</span> Firm-Owned Shared Queues. Work does not belong to individual inboxes. It lives in firm-controlled workbaskets. Reassigning 50 dockets to a new associate takes exactly 5 seconds.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 hover:border-slate-700 transition-all">
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 mb-4">
                Feature: Fee-Earner Telemetry
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2">
                4. "Zero Real-Time Capacity Planning"
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                During September and October annual filing crunches, partners have zero telemetry on who is overloaded and who has bandwidth. Spreadsheets show dates, but not work effort, queue bottlenecks, or SLA slip risk.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-400">
                <span className="font-bold text-amber-400">The Docketra Fix:</span> Live Partner Telemetry. Instant breakdown of open dockets by fee-earner, stage distribution, SLA countdown, and overdue risk metrics across your entire team.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Migration Engine Section ("Switching from Excel Takes Minutes") */}
      <section className="border-t border-slate-800/90 bg-gradient-to-b from-slate-900/70 to-slate-950 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-3">
              Zero-Friction Practice On-Ramp
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
              Switching from Excel Takes Minutes
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              You don’t have to manually re-type client data. Docketra is equipped with 4 automated spreadsheet ingestion engines built right into the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4">
                  01
                </div>
                <h4 className="text-base font-bold text-white mb-2">Client Master Importer</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Upload CSV or Excel spreadsheets with client entities. Auto-validates 21-digit CIN, PAN, GSTIN, and TAN formats with pre-flight dry runs.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-[11px] font-mono text-emerald-400 border border-slate-800">
                ✓ Schema validation + Error CSV
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4">
                  02
                </div>
                <h4 className="text-base font-bold text-white mb-2">Quick Bulk Paste</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Copy tab-separated cells directly from Microsoft Excel or Google Sheets and paste them right into Docketra without exporting or downloading files.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-[11px] font-mono text-emerald-400 border border-slate-800">
                ✓ Direct clipboard copy-paste
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4">
                  03
                </div>
                <h4 className="text-base font-bold text-white mb-2">Historical Docket Importer</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Download pre-formatted templates to bring multi-year filing histories, ongoing secretarial matters, and past annual compliance records into your firm brain.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-[11px] font-mono text-emerald-400 border border-slate-800">
                ✓ Multi-year history migration
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4">
                  04
                </div>
                <h4 className="text-base font-bold text-white mb-2">Team & Taxonomy Bulk Setup</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  One-click mapping for your partners, managers, and associates, plus customized compliance categories (ROC, GST, IT, FEMA, Trademark).
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-[11px] font-mono text-emerald-400 border border-slate-800">
                ✓ Automated role provisioning
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Sandbox Preview Anchor */}
      <section id="sandbox-preview" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 shadow-2xl">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-xl sm:text-3xl font-extrabold text-white">
              Experience the Company Brain in Action
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Interactive preview: see how Docketra organizes client entity memory, review gates, and live workbaskets.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-400">docketra.in/app/firm/sharma-associates</span>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                Live Firm Workspace
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Active Dockets</p>
                  <p className="text-xl font-bold text-white mt-1">48 Matters</p>
                  <p className="text-[10px] text-emerald-400 mt-1">100% on schedule</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Awaiting QC Sign-Off</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">6 Draft Filings</p>
                  <p className="text-[10px] text-amber-400 mt-1">Partner review gate active</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Storage Posture</p>
                  <p className="text-xl font-bold text-white mt-1">BYOS Active</p>
                  <p className="text-[10px] text-slate-400 mt-1">Google Drive • Mumbai Tier-IV</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                  <span>Recent Client Entities in Memory</span>
                  <span className="text-amber-400 font-mono text-[11px]">Instant Search (`Ctrl+K`)</span>
                </div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Reliance Energy Infrastructure Ltd</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">CIN: L40100MH2000PLC123456</span>
                    </div>
                    <span className="text-[11px] text-slate-400">8 dockets • 34 filings logged</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Bharat BioTech Ventures LLP</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">LLPIN: AAB-4921</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Form 11 Filed • Audit Complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Pilot Program Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Official Pilot Cohort</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">
              Why Join the 3-Month Free Pilot?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              We are partnering with select Indian CS, CA, and corporate legal practices to build the definitive institutional practice operating system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                90d
              </div>
              <h4 className="text-base font-bold text-white">100% Free Full Workspace</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                90 days of unrestricted firm access for all partners, associates, and trainees with unlimited dockets, client entities, and storage.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                🤝
              </div>
              <h4 className="text-base font-bold text-white">White-Glove Migration</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Our engineering team personally assists your firm in importing your existing Excel client master files, setting up categories, and configuring workbaskets.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                ⚡
              </div>
              <h4 className="text-base font-bold text-white">Direct Founder Hotline</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct WhatsApp and Slack channels with Docketra’s core product engineering team to request custom compliance workflows and statutory form templates.
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
              Everything You Need to Know About the Pilot
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
            Upgrade Your Firm’s Operating Engine Risk-Free
          </h3>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Claim your 3-month pilot access today. Bring your spreadsheets over in minutes and experience calm,
            audit-ready practice management.
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
            Immediate workspace setup • Full CSV migration support • No credit card required
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
