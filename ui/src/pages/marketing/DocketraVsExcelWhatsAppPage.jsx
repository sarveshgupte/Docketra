import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicMarketingHeader from '../../components/marketing/PublicMarketingHeader';
import { MarketingFooter } from '../../components/landing/LandingPageContent';
import Container from '../../components/layout/Container';
import SeoHead from '../../components/common/SeoHead';

const FAQ_ITEMS = [
  {
    id: 'pilot-details',
    question: 'What is included in the 3-month free pilot?',
    answer:
      'The 3-month pilot provides complete, unrestricted firm-wide access for all partners, associates, and trainees. You get unlimited client entities, dockets, automated MCA/ROC/tax calendar tracking, 4-eye QC review gates, BYOS Google Drive integration, and dedicated 1-on-1 onboarding support with zero setup fees and no credit card required.',
  },
  {
    id: 'migration-ease',
    question: 'How hard is it to migrate our existing client spreadsheet?',
    answer:
      'Switching takes minutes. Docketra features a built-in Client Master Importer with dry-run validation for CIN, PAN, GSTIN, and TAN formats. You can either upload your existing CSV/Excel file or copy-paste tab-separated cells directly from spreadsheets. Any invalid rows generate an error report with exact line numbers for instant resolution.',
  },
  {
    id: 'statutory-formats',
    question: 'How does Docketra handle Indian statutory formats?',
    answer:
      'Docketra is engineered specifically for Indian compliance practices. It natively validates 21-digit Corporate Identification Numbers (CIN), 10-digit PAN/TAN, 15-digit GSTIN, and DINs. It organizes MCA V3 annual filings (AOC-4, MGT-7), secretarial audits, board resolutions, and tax due dates into structured dockets with automatic statutory alerts.',
  },
  {
    id: 'vs-generic-tools',
    question: 'How does Docketra compare to generic tools like ClickUp, Notion, or Asana?',
    answer:
      'Generic tools lack Indian statutory semantics: they have no concept of a CIN, 4-eye partner sign-offs, statutory filing penalties, or MCA compliance calendars. Setting them up requires months of custom consulting. Docketra is purpose-built and ready on day one with compliance workbaskets, client memory, and audit trails tailored for Indian CA and CS practices.',
  },
  {
    id: 'security-sovereignty',
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

const COMPARISON_ROWS = [
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
    docketra: '100% in your firm’s own Google Drive with restricted drive.file isolation and zero vendor lock-in.',
  },
  {
    feature: 'Trainee Laptop Leak Protection',
    excel: 'Client files scatter across personal article laptops with zero download controls or exit safeguards.',
    docketra: 'Trainee Laptop Shield actively blocks junior assistants from downloading raw client files to personal laptops.',
  },
  {
    feature: 'Client Intake & WhatsApp Friction',
    excel: 'Clients refuse external portals and dump unstructured bills/challans into WhatsApp chats; clerks spend hours digging through message threads.',
    docketra: 'Direct WhatsApp Forwarding Bridge. Clients continue sending files on WhatsApp as usual; clerks bridge media straight into dockets with 1-click Google Drive sync.',
  },
];

const MIGRATION_CARDS = [
  {
    num: '01',
    title: 'Client Master Importer',
    description: 'Upload CSV or Excel spreadsheets with client entities. Auto-validates 21-digit CIN, PAN, GSTIN, and TAN formats with pre-flight dry runs.',
    badge: '✓ Schema validation + Error CSV',
  },
  {
    num: '02',
    title: 'Quick Bulk Paste',
    description: 'Copy tab-separated cells directly from Microsoft Excel or Google Sheets and paste them right into Docketra without exporting or downloading files.',
    badge: '✓ Direct clipboard copy-paste',
  },
  {
    num: '03',
    title: 'Historical Docket Importer',
    description: 'Download pre-formatted templates to bring multi-year filing histories, ongoing secretarial matters, and past annual compliance records into your firm brain.',
    badge: '✓ Multi-year history migration',
  },
  {
    num: '04',
    title: 'Team & Taxonomy Bulk Setup',
    description: 'One-click mapping for your partners, managers, and associates, plus customized compliance categories (ROC, GST, IT, FEMA, Trademark).',
    badge: '✓ Automated role provisioning',
  },
];

export const DocketraVsExcelWhatsAppPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activeSandboxTab, setActiveSandboxTab] = useState('memory');

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25 font-sans">
      <SeoHead
        canonicalPath="/compare/docketra-vs-excel-whatsapp"
        title="Docketra vs Excel & WhatsApp | 3-Month Free Pilot for Indian Compliance Firms"
        description="Outgrow spreadsheet chaos and lost WhatsApp files. Switch to Docketra in minutes with built-in Excel/CSV importers and claim a 3-month free pilot."
        jsonLd={FAQ_SCHEMA}
      />

      {/* Top Eyebrow Pilot Banner */}
      <div className="border-b border-amber-200/90 bg-amber-50/70 px-4 py-2 text-center text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 font-bold text-amber-900 font-mono text-[11px]">
            🚀 Docketra Pilot Cohort Open
          </span>
          <span className="text-slate-700 font-medium">
            Exclusive for Indian CS, CA & Corporate Legal Practices • 3 Months Free Access • 0 Setup Fees
          </span>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            Claim Pilot Seat →
          </Link>
        </div>
      </div>

      {/* Shared Navigation Header */}
      <PublicMarketingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50/40 pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-200">
        <Container size="7xl">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Comparison Guide • Built for Indian Compliance Practitioners
              </div>
              <span className="text-slate-300">•</span>
              <div className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span>Zero File Leakage • 100% Partner Review</span>
              </div>
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              The Hidden Cost of Managing Indian Compliance on <span className="text-amber-600">Excel & WhatsApp</span>
            </h1>

            <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-2xl mx-auto">
              Run your practice from your own Google Drive. Zero file leakage, 100% partner review. Why leading firms replace messy WhatsApp groups and spreadsheets with maker-checker discipline.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800 rounded-md"
              >
                <span>Join Pilot (3 Months Free)</span>
                <span>→</span>
              </Link>
              <a
                href="#sandbox-preview"
                className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors rounded-md"
              >
                <span>Explore Interactive Sandbox</span>
              </a>
            </div>

            {/* Risk-Reversal Subtext */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>No credit card required</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>Full workspace access</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">✓</span>
                <span>1-Click Excel data import</span>
              </span>
            </div>
          </div>

          {/* Visual Mockup Card */}
          <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* The Old Way: Spreadsheets & WhatsApp */}
              <div className="rounded-md border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">The Fragmented Way</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Excel + WhatsApp</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="rounded border border-rose-200/80 bg-white p-2.5 font-mono text-[11px]">
                    <span className="text-rose-700 font-bold">Client Tracker_v14_final.xlsx:</span> Row 48 cell edited 12 days ago without alert.
                  </div>
                  <div className="rounded border border-rose-200/80 bg-white p-2.5">
                    <p className="text-slate-500 text-[11px] font-semibold mb-1">WhatsApp Group "Acme Compliance":</p>
                    <p className="italic text-slate-700">"Where is the DIN KYC OTP? Did we file AOC-4 yesterday? Who has DSC PIN?"</p>
                  </div>
                  <div className="rounded border border-rose-200/80 bg-rose-100/60 p-2 text-rose-800 text-[11px] font-medium">
                    Result: Partner spends 3 hours chasing files. Filing delayed. ROC late fees applied.
                  </div>
                </div>
              </div>

              {/* The Modern Way: Docketra */}
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">The Modern Operating System</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 font-mono">Docketra</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-900 font-mono">DOCKET-2026-MCA-089</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-200 text-[10px]">QC Approved</span>
                    </div>
                    <p className="text-slate-800 text-[11px] mt-1 font-medium">Acme FinTech Ltd • MCA Form AOC-4 Filing</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-mono">CIN: U72200MH2021PTC368291 • Due in 4 days • Auto-alert active</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-[11px] font-semibold">4-Eye Partner Gate Passed</p>
                      <p className="text-slate-500 text-[10px]">Signed off by Managing Partner (Audit log #3829)</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 font-bold">100% Ready</span>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900 text-[11px] font-medium">
                    Result: Zero missed deadlines. Instant partner visibility. Audit trail preserved.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Comparison Matrix Section */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">The Cold Reality</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Excel & WhatsApp vs. Docketra
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              See why spreadsheets break as soon as your firm handles more than 25 corporate entities.
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold">
                  <th scope="col" className="py-3.5 px-5 text-slate-900 w-[26%]">Practice Area</th>
                  <th scope="col" className="py-3.5 px-5 text-rose-900 w-[37%] bg-rose-50/40 border-r border-slate-200">
                    Excel & WhatsApp (The Fragile Stack)
                  </th>
                  <th scope="col" className="py-3.5 px-5 text-slate-900 w-[37%] bg-emerald-50/40">
                    Docketra (The Company Brain)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs sm:text-sm text-slate-700">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-[background-color]">
                    <td className="py-3.5 px-5 font-bold text-slate-950 align-top">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-5 align-top text-slate-600 bg-rose-50/20 border-r border-slate-200">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="inline-flex items-center justify-center h-4 w-4 rounded-xs bg-rose-50 text-rose-600 font-semibold shrink-0 mt-0.5 text-[10px] leading-none border border-rose-200/60"
                          aria-hidden="true"
                        >
                          ✕
                        </span>
                        <span className="text-slate-600 leading-relaxed text-xs">{row.excel}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 align-top bg-emerald-50/15">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="inline-flex items-center justify-center h-4 w-4 rounded-xs bg-emerald-100 text-emerald-800 font-bold shrink-0 mt-0.5 text-[11px] leading-none"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="font-medium text-slate-900 leading-relaxed text-xs">{row.docketra}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-4">
            {COMPARISON_ROWS.map((row, idx) => (
              <div key={idx} className="rounded-md border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <h3 className="text-sm font-bold text-slate-950 border-b border-slate-100 pb-2">
                  {row.feature}
                </h3>
                <div className="rounded border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-950">
                  <p className="font-bold text-rose-800 mb-1">Excel & WhatsApp:</p>
                  <p className="leading-relaxed text-slate-600">{row.excel}</p>
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-950">
                  <p className="font-bold text-emerald-800 mb-1">Docketra:</p>
                  <p className="leading-relaxed text-slate-800">{row.docketra}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* The 4 Breaking Points Deep Dive */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Root-Cause Analysis</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              The 4 Breaking Points of Unstructured Practice Operations
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Why adding more spreadsheets and WhatsApp groups only accelerates chaos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 hover:border-slate-400 transition-colors shadow-xs">
              <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mb-3">
                Feature: Client Memory
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-950 mb-2">
                1. "The Senior Partner Becomes an Internal Search Engine"
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                When entity knowledge lives in chat threads, partners spend 30% of their workday answering associate questions:
                <em className="text-slate-500 block mt-1">"Who is the authorized signatory for XYZ Corp? Did we file form DIR-12 last quarter? Where is the signed MOA?"</em>
              </p>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-bold text-amber-700">The Docketra Fix:</span> Institutional Client Memory. Every entity’s master data (CIN, DIN, PAN, registered office, statutory records, past resolutions) is indexed and searchable across the entire firm in 1 click.
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 hover:border-slate-400 transition-colors shadow-xs">
              <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mb-3">
                Feature: Review Gates
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-950 mb-2">
                2. "QC Reviews Disappear into WhatsApp Noise"
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                Draft forms, board resolutions, and tax returns are dropped into WhatsApp groups for review. Amid 80 other notifications, they get lost. Submissions occur without formal partner sign-off until an ROC defect notice or penalty letter arrives.
              </p>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-bold text-amber-700">The Docketra Fix:</span> 4-Eye Review Gates. Dockets cannot advance to filing until assigned managers or partners approve the work in dedicated QC Baskets with complete revision history.
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 hover:border-slate-400 transition-colors shadow-xs">
              <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mb-3">
                Feature: Firm-Owned Worklists
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-950 mb-2">
                3. "Institutional Brain Drain on Staff Exit"
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                Article assistants and junior associates rotate every 12 to 24 months. When an associate leaves, client draft files on their personal laptops, pending form checklists, and WhatsApp message context walk out the door with them.
              </p>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-bold text-amber-700">The Docketra Fix:</span> Firm-Owned Shared Queues. Work does not belong to individual inboxes. It lives in firm-controlled workbaskets. Reassigning 50 dockets to a new associate takes exactly 5 seconds.
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 hover:border-slate-400 transition-colors shadow-xs">
              <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mb-3">
                Feature: Fee-Earner Telemetry
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-950 mb-2">
                4. "Zero Real-Time Capacity Planning"
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                During September and October annual filing crunches, partners have zero telemetry on who is overloaded and who has bandwidth. Spreadsheets show dates, but not work effort, queue bottlenecks, or SLA slip risk.
              </p>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-bold text-amber-700">The Docketra Fix:</span> Live Partner Telemetry. Instant breakdown of open dockets by fee-earner, stage distribution, SLA countdown, and overdue risk metrics across your entire team.
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Migration Engine Section */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Zero-Friction Practice On-Ramp</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Switching from Excel Takes Minutes
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              You don’t have to manually re-type client data. Docketra is equipped with 4 automated spreadsheet ingestion engines built right into the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MIGRATION_CARDS.map((card, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-400 transition-colors shadow-xs"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                    {card.num}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-slate-950">{card.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed mb-4">
                    {card.description}
                  </p>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-2 text-[10px] font-mono font-medium text-slate-700">
                  {card.badge}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Interactive Sandbox Preview Anchor */}
      <section id="sandbox-preview" className="py-16 bg-slate-50/40 border-b border-slate-200 scroll-mt-16">
        <Container size="7xl">
          <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                Experience the Company Brain in Action
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Interactive preview: see how Docketra organizes client entity memory, review gates, and live workbaskets.
              </p>

              {/* Interactive Tab Switcher */}
              <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSandboxTab('memory')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activeSandboxTab === 'memory' ? 'bg-slate-950 text-white font-bold' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Client Memory
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSandboxTab('qc')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activeSandboxTab === 'qc' ? 'bg-slate-950 text-white font-bold' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  4-Eye QC Gate
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSandboxTab('importer')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    activeSandboxTab === 'importer' ? 'bg-slate-950 text-white font-bold' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Excel Import Dry-Run
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
                    docketra.in/app/firm/sharma-associates
                  </span>
                </div>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono shrink-0">
                  Live Firm Workspace
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {activeSandboxTab === 'memory' && (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Active Dockets</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">48 Matters</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">100% on schedule</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Awaiting QC Sign-Off</p>
                        <p className="text-lg font-bold text-amber-700 mt-0.5">6 Draft Filings</p>
                        <p className="text-[10px] text-amber-800 mt-0.5">Partner review gate active</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Storage Posture</p>
                        <p className="text-lg font-bold text-slate-950 mt-0.5">BYOS Active</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Google Drive • Mumbai Tier-IV</p>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Recent Client Entities in Memory</span>
                        <span className="text-amber-700 font-mono text-[11px]">Instant Search (`Ctrl+K`)</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">Reliance Energy Infrastructure Ltd</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">CIN: L40100MH2000PLC123456</span>
                          </div>
                          <span className="text-[11px] text-slate-500">8 dockets • 34 filings logged</span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">Bharat BioTech Ventures LLP</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">LLPIN: AAB-4921</span>
                          </div>
                          <span className="text-[11px] text-slate-500">Form 11 Filed • Audit Complete</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'qc' && (
                  <div className="space-y-3">
                    <div className="rounded border border-amber-200 bg-amber-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-amber-900 font-mono">Pending Review: DOCKET-2026-MCA-092</span>
                        </div>
                        <span className="rounded bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-mono border border-amber-200">Stage: Partner Review</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-2">MGT-7 Annual Return Draft Review for Acme Infotech Pvt Ltd</p>
                      <p className="text-xs text-slate-600 mt-1">Prepared by: Priya Sharma (Associate) • Attached files: Form_MGT7_Final.pdf (Signed)</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="rounded bg-slate-950 px-3 py-1 text-xs font-bold text-amber-400">Approve & Sign-off</span>
                        <span className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">Reject with Notes</span>
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Immutable Sign-off Audit Trail: Every approval logs timestamp, Partner ID, and digital hash to protect against unvetted submissions.
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'importer' && (
                  <div className="space-y-3">
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                        <span>Dry-Run Preflight Preview: client_master_march2026.xlsx</span>
                        <span className="text-emerald-700 font-mono text-[11px] font-bold">42 Valid / 1 Warning</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono border-collapse">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-200 bg-slate-50">
                              <th className="py-1.5 px-2">Row</th>
                              <th className="py-1.5 px-2">Entity Name</th>
                              <th className="py-1.5 px-2">CIN / LLPIN</th>
                              <th className="py-1.5 px-2">PAN</th>
                              <th className="py-1.5 px-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="py-1.5 px-2 text-slate-400">1</td>
                              <td className="py-1.5 px-2 text-slate-900 font-medium">Aditi Logistics Pvt Ltd</td>
                              <td className="py-1.5 px-2 text-emerald-700">U60200MH2018PTC304192</td>
                              <td className="py-1.5 px-2 text-slate-600">AABCA1234F</td>
                              <td className="py-1.5 px-2 text-emerald-700 font-bold">Valid</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 px-2 text-slate-400">2</td>
                              <td className="py-1.5 px-2 text-slate-900 font-medium">Horizon Fintech LLP</td>
                              <td className="py-1.5 px-2 text-emerald-700">AAA-9821</td>
                              <td className="py-1.5 px-2 text-slate-600">AAFFH5678G</td>
                              <td className="py-1.5 px-2 text-emerald-700 font-bold">Valid</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 px-2 text-slate-400">3</td>
                              <td className="py-1.5 px-2 text-slate-900 font-medium">Nova Pharma Ltd</td>
                              <td className="py-1.5 px-2 text-amber-700">L24230DL1995PLC01234 (20 char)</td>
                              <td className="py-1.5 px-2 text-slate-600">AABCN9988H</td>
                              <td className="py-1.5 px-2 text-amber-700 font-bold">CIN 21-digit check</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Automatic validation catches typo errors before creating records in your live workspace.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Why Join Pilot Program Section */}
      <section className="py-16 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Official Pilot Cohort</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Why Join the 3-Month Free Pilot?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              We are partnering with select Indian CS, CA, and corporate legal practices to build the definitive institutional practice operating system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                90d
              </span>
              <h3 className="text-sm font-bold text-slate-950">100% Free Full Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                90 days of unrestricted firm access for all partners, associates, and trainees with unlimited dockets, client entities, and storage.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                02
              </span>
              <h3 className="text-sm font-bold text-slate-950">White-Glove Migration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our engineering team personally assists your firm in importing your existing Excel client master files, setting up categories, and configuring workbaskets.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5 space-y-2 hover:border-slate-400 transition-colors shadow-xs">
              <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
                03
              </span>
              <h3 className="text-sm font-bold text-slate-950">Direct Founder Hotline</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct WhatsApp and Slack channels with Docketra’s core product engineering team to request custom compliance workflows and statutory form templates.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Interactive FAQ Accordion */}
      <section className="py-16 bg-slate-50/40 border-b border-slate-200">
        <Container size="7xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Frequently Asked Questions</div>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Everything You Need to Know About the Pilot
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
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between p-4 text-left text-sm font-bold text-slate-950 select-none cursor-pointer"
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
      <section className="py-16 bg-white border-b border-slate-200 text-center">
        <Container size="7xl">
          <div className="border border-slate-200 bg-slate-50/60 p-8 sm:p-10 rounded-lg max-w-4xl mx-auto space-y-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Zero Financial Commitment • Limited Pilot Cohort
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Upgrade Your Firm’s Operating Engine Risk-Free
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Claim your 3-month pilot access today. Bring your spreadsheets over in minutes and experience calm,
              audit-ready practice management.
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
              Immediate workspace setup • Full CSV migration support • No credit card required
            </p>
          </div>
        </Container>
      </section>

      {/* Shared Marketing Footer */}
      <MarketingFooter />
    </div>
  );
};

export default DocketraVsExcelWhatsAppPage;
