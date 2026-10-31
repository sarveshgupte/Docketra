import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import LandingProductTourModal from './LandingProductTourModal';
import InteractiveProductCanvas from './InteractiveProductCanvas';
import ComplianceVsGenericComparison from './ComplianceVsGenericComparison';
import Container from '../layout/Container';
import SeoHead from '../common/SeoHead';

const REVEAL = {
  initial: false,
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.08 },
};

const PRACTICE_PILLARS = [
  {
    id: 'cs',
    title: 'Company Secretaries (PCS)',
    role: 'Corporate Governance & ROC Radar',
    stat: 'MCA V3 Ready',
    description: 'Track annual filings, director KYC, board resolutions, and charge registrations without spreadsheet chaos.',
    capabilities: [
      { form: 'AOC-4 & MGT-7', label: 'Annual filing checklists with pre-scrutiny verification' },
      { form: 'DIR-3 KYC & DSC', label: 'Director identification and token validity tracking' },
      { form: 'PAS-3 & CHG-1', label: 'Allotment and charge creation audit trail' },
      { form: 'ROC Cutoff Radar', label: 'Automated warnings before compounding late fee penalties apply' },
    ],
    link: '/solutions/company-secretaries',
  },
  {
    id: 'ca',
    title: 'Chartered Accountants (CA)',
    role: 'Taxation, GST & Statutory Audit',
    stat: 'Private Drive BYOS',
    description: 'Keep working papers, challans, and 3CD audit schedules protected inside your private Google Drive.',
    capabilities: [
      { form: 'Tax Audit 3CD', label: 'Clause-by-clause trainee checklists with maker-checker sign-off' },
      { form: 'GSTR-3B & 9', label: 'Monthly reconciliation queues and challan storage' },
      { form: 'Client Drop Link', label: 'Simple upload link so clients send bills with zero login hassle' },
      { form: 'Trainee Shield', label: 'Article assistants cannot copy client ledgers onto personal hard drives' },
    ],
    link: '/solutions/chartered-accountants',
  },
  {
    id: 'legal',
    title: 'Corporate Legal Teams',
    role: 'Litigation, Contracts & Advisory',
    stat: 'Audit Trail Sealed',
    description: 'Track tribunal dates, company petitions, notice replies, and client dockets in a unified sovereign vault.',
    capabilities: [
      { form: 'NCLT & HC Radar', label: 'Next hearing tracking with order sheet repository' },
      { form: 'Docket Folders', label: 'Case briefs and pleadings organized automatically in Drive' },
      { form: 'Partner Approval', label: 'Mandatory quality review on legal notices and plaints' },
      { form: 'Client Memory', label: 'Entity master registry with director and signatory dossiers' },
    ],
    link: '/solutions/corporate-legal-teams',
  },
];

const CheckIcon = () => (
  <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-slate-50/60 pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-24 border-b border-slate-200">
    <Container size="7xl" className="relative">
      <div className="grid items-center gap-10 lg:gap-12 lg:grid-cols-2">
        <motion.div {...REVEAL} className="space-y-5">
          {/* Headline - Primary H1 */}
          <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl [text-wrap:balance]">
            The Company Brain for Indian professional firms.
          </h1>

          {/* Lede - Simple plain English */}
          <p className="text-base sm:text-lg font-normal leading-relaxed text-slate-600 max-w-xl [text-wrap:pretty]">
            Built for Indian professional firms: CS, CA, law, and compliance teams.
          </p>

          {/* Practice Quick-Navigation Strip */}
          <div className="pt-1 pb-1">
            <span className="text-xs font-semibold text-slate-500 block mb-2">
              Tailored For Your Practice:
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                to="/solutions/company-secretaries"
                className="inline-flex items-center border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-xs rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
              >
                <span>Company Secretaries (PCS)</span>
              </Link>
              <Link
                to="/solutions/chartered-accountants"
                className="inline-flex items-center border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-xs rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
              >
                <span>Chartered Accountants (CA)</span>
              </Link>
              <Link
                to="/solutions/corporate-legal-teams"
                className="inline-flex items-center border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-xs rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
              >
                <span>Corporate Legal Teams</span>
              </Link>
              <Link
                to="/compare/docketra-vs-excel-whatsapp"
                className="inline-flex items-center border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:border-amber-400 hover:text-amber-950 transition-colors rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-amber-100"
              >
                <span>vs. Excel &amp; WhatsApp</span>
              </Link>
            </div>
          </div>

          {/* Primary Action Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xs bg-slate-950 px-6 text-sm font-semibold text-amber-300 transition-colors hover:bg-slate-800 shadow-sm shrink-0 whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900"
            >
              <span>Create workspace</span>
            </Link>

            <Link
              to="/find-workspace"
              className="inline-flex h-12 items-center justify-center rounded-xs border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs shrink-0 whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
            >
              <span>Find workspace</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex h-12 items-center justify-center rounded-xs border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs shrink-0 whitespace-nowrap cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Product tour</span>
            </button>
          </div>

          {/* Value Badges */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 pt-2">
            <span className="flex items-center gap-2">
              <CheckIcon />
              <span>Private Google Drive storage</span>
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon />
              <span>Partner review on every filing</span>
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon />
              <span>Free evaluation for up to 5 clients</span>
            </span>
          </div>
        </motion.div>

        {/* Right Hero: The Interactive Workstation Signature */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="relative w-full max-w-full"
        >
          <InteractiveProductCanvas />
        </motion.div>
      </div>
    </Container>
  </section>
);

const HighlightsStrip = () => (
  <section className="border-b border-slate-200 bg-white py-8">
    <Container size="7xl">
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            stat: '100% Drive BYOS',
            label: 'Private Google Drive',
            desc: 'Files save strictly into your own Drive. Zero third-party cloud custody.',
          },
          {
            stat: 'Trainee Shield',
            label: 'Endpoint Protection',
            desc: 'Clerks view documents in-browser. Raw file downloads to personal laptops are blocked.',
          },
          {
            stat: '100% Partner Sign-off',
            label: 'Maker-Checker QC',
            desc: 'Mandatory partner review before any form is submitted to government portals.',
          },
          {
            stat: 'Drive Tamper Guard',
            label: 'Automatic Recovery',
            desc: 'Accidental folder moves or deletions in Google Drive heal automatically.',
          },
        ].map((item, idx) => (
          <div key={idx} className="border-l-2 border-slate-300 pl-4 py-1 hover:border-slate-900 transition-colors">
            <span className="text-xs font-medium text-slate-500 block">{item.label}</span>
            <p className="text-base font-bold text-slate-950 mt-1">{item.stat}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const PracticeMatrixSection = () => {
  const [activeTab, setActiveTab] = useState('cs');
  const currentPillar = PRACTICE_PILLARS.find((p) => p.id === activeTab) || PRACTICE_PILLARS[0];

  return (
    <section id="product" className="scroll-mt-16 bg-slate-50/50 py-16 sm:py-24 border-b border-slate-200">
      <Container size="7xl">
        <motion.div className="max-w-3xl" {...REVEAL}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950 [text-wrap:balance]">
            Tailored Regulatory Engines for Indian Practices
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl [text-wrap:pretty]">
            Generic tools fail because they do not understand MCA V3 forms, Form 3CD clauses, GSTR-3B cutoffs, or peer review standards. Docketra organizes your work into clear Worklist queues, department Workbaskets, and QC Workbaskets.
          </p>
        </motion.div>

        {/* Practice Selector Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {PRACTICE_PILLARS.map((pillar) => (
            <button
              key={pillar.id}
              type="button"
              onClick={() => setActiveTab(pillar.id)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-sm border transition-colors cursor-pointer flex items-center gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === pillar.id
                  ? 'border-slate-950 bg-slate-950 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
              }`}
            >
              <span>{pillar.title}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-xs border ${
                  activeTab === pillar.id
                    ? 'border-amber-400 bg-slate-900 text-amber-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {pillar.stat}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Practice Display */}
        <div className="mt-6 border border-slate-200 bg-white p-6 sm:p-8 rounded-lg shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 border border-amber-200 rounded-xs">
                {currentPillar.role}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-3">
                {currentPillar.title}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {currentPillar.description}
              </p>
            </div>
            <Link
              to={currentPillar.link}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-slate-50 text-slate-800 font-semibold text-xs rounded hover:bg-slate-100 hover:border-slate-400 transition-colors self-start lg:self-auto shrink-0 shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-200"
            >
              <span>Explore {currentPillar.title.split(' ')[0]} Workflows</span>
            </Link>
          </div>

          <div className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {currentPillar.capabilities.map((cap, idx) => (
              <div key={idx} className="border border-slate-200 bg-slate-50/70 p-4 rounded-md space-y-1 hover:border-slate-300 transition-colors">
                <span className="font-mono text-xs font-bold text-slate-950 block">
                  {cap.form}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {cap.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Modules Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Client Memory Dossier',
              body: 'Centralize CIN, PAN, TAN, DIN, authorized signatories, and DSC expiry in one master card with one-click portal copy.',
              tag: '1-Click Portal Copy',
            },
            {
              title: 'Zero-Login Client Upload Link',
              body: 'Send clients a secure WhatsApp-friendly link to drop bank statements, bills, and challans without password hassle.',
              tag: 'No Password Friction',
            },
            {
              title: 'Personal Worklists & Shared Queues',
              body: 'Staff receive prioritized daily Worklists, while practice managers route complex cases through department Workbaskets.',
              tag: 'Clear Accountability',
            },
            {
              title: 'Mandatory QC & 4-Eye Review',
              body: 'Draft filings and working papers cannot be closed without partner verification in QC Workbaskets.',
              tag: 'Partner Review Enforced',
            },
            {
              title: 'Pre-loaded Statutory Blueprints',
              body: 'Standardized workflows for MCA annual filings, Form 3CD clauses, GSTR reconciliations, and DIR-3 KYC.',
              tag: 'Article Clerk Guidance',
            },
            {
              title: 'Private Google Drive Storage',
              body: 'Client documents never leave your firm’s Google Drive. Even if you cancel Docketra, 100% of your records stay in your own folders.',
              tag: 'Permanent Custody',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-400 transition-colors rounded shadow-xs"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{feature.body}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 font-medium">
                <CheckIcon />
                <span>{feature.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};

const ProblemSection = () => (
  <section id="why" className="scroll-mt-16 bg-white py-16 sm:py-24 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-3xl" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950 [text-wrap:balance]">
          Why Excel & WhatsApp Fail Busy Professional Firms
        </h2>
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed [text-wrap:pretty]">
          WhatsApp mixes confidential PAN copies and financial statements with personal conversations. Excel cannot prevent trainee data leakage, track MCA late fees, or enforce partner sign-offs.
        </p>
      </motion.div>

      <div className="mt-8">
        <ComplianceVsGenericComparison />
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-slate-50/50 py-16 sm:py-24 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-3xl" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950 [text-wrap:balance]">
          How Work Moves Through Docketra
        </h2>
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed [text-wrap:pretty]">
          A clear 4-step workflow built for the maker-checker standard: staff prepares, partners review, and all files stay inside your firm’s private Google Drive.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: '01',
            title: 'Create the Docket',
            desc: 'Open a client matter in seconds. A dedicated folder is created automatically in your firm’s Google Drive.',
            detail: 'Private folder in your own Drive',
          },
          {
            step: '02',
            title: 'Assign to Staff',
            desc: 'Assign filing steps to associates or article clerks with pre-loaded statutory checklists and clear deadlines.',
            detail: 'Blocks file downloads to personal laptops',
          },
          {
            step: '03',
            title: 'Collect & Prepare',
            desc: 'Clients upload documents via secure, no-login links. All drafts and working papers save directly into your Drive.',
            detail: 'Zero files touch external cloud servers',
          },
          {
            step: '04',
            title: 'Partner Sign-Off',
            desc: 'Partners verify draft challans and working papers in QC Workbaskets, sign off with one click, and submit to government portals.',
            detail: 'Audit trail ready for ICAI & ICSI reviews',
          },
        ].map((item) => (
          <div key={item.step} className="border border-slate-200 bg-white p-6 hover:border-slate-400 transition-colors rounded shadow-xs">
            <h3 className="text-sm font-bold text-slate-950">
              <span className="text-amber-800 font-semibold mr-1.5">{item.step}.</span>
              {item.title}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-slate-950 py-16 sm:py-24 text-white border-b border-slate-800">
    <Container size="7xl">
      <motion.div className="max-w-3xl" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance]">
          Your Client Files Stay in Your Firm’s Own Google Drive
        </h2>
        <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed [text-wrap:pretty]">
          Docketra never stores client documents on external servers. Your files stay inside your firm’s private Google Drive, and we only manage deadlines, checklists, and approval workflows.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-slate-800 bg-slate-900/60 p-6 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Restricted Drive Scope</h3>
            <span className="text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-xs border border-emerald-800">Verified private</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Docketra can only open the specific folders it creates for your dockets. It has zero access to your firm’s existing emails, documents, or personal Drive archives.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-6 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Prevent Local Downloads</h3>
            <span className="text-xs text-amber-400 bg-amber-950 px-2 py-0.5 rounded-xs border border-amber-800">Leak protection</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Article clerks and junior staff view files securely in their browser. Downloading confidential PANs, tax returns, or bank statements to personal laptops is blocked.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-6 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Automatic Folder Recovery</h3>
            <span className="text-xs text-sky-400 bg-sky-950 px-2 py-0.5 rounded-xs border border-sky-800">Auto-recovery</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            If someone accidentally moves, renames, or deletes a folder in Google Drive, Docketra detects it immediately and restores the links with zero data loss.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-6 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Peer-Review Audit Trail</h3>
            <span className="text-xs text-purple-400 bg-purple-950 px-2 py-0.5 rounded-xs border border-purple-800">Audit ready</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            An uneditable audit log records every action: who prepared the filing, what changed, and when the partner signed off. Ready for ICAI and ICSI peer reviews.
          </p>
        </div>
      </div>
    </Container>
  </section>
);

const PilotReadinessSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-white py-16 sm:py-24 border-b border-slate-200">
    <Container size="7xl">
      <div className="border border-slate-300 bg-slate-50/70 p-6 sm:p-10 rounded-lg shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
              Start Using Docketra for Your Firm in 5 Minutes
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed [text-wrap:pretty]">
              Create your firm workspace, invite your team, and manage your first 5 clients for ₹0. Upgrade to Pioneer or Growth whenever you expand.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto h-12 items-center justify-center gap-2 bg-slate-950 px-6 text-sm font-semibold text-amber-300 transition-colors hover:bg-slate-800 shrink-0 shadow-sm whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900"
            >
              <span>Create workspace</span>
            </Link>
            <Link
              to="/pricing"
              className="inline-flex w-full sm:w-auto h-12 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shrink-0 shadow-xs whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
            >
              <span>View all plans &amp; pricing</span>
            </Link>
          </div>
        </div>

        {/* 3 Value Pillars */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="flex items-center gap-2">
              <CheckIcon />
              <span className="font-bold text-slate-900 text-sm">Free Pilot (₹0 forever)</span>
            </div>
            <p className="text-slate-600 mt-2 leading-relaxed">
              2 seats, 5 clients. Official sandbox for Google Drive safety &amp; junior download blocks.
            </p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="flex items-center gap-2">
              <CheckIcon />
              <span className="font-bold text-slate-900 text-sm">Pioneer 30 (₹12,990/year)</span>
            </div>
            <p className="text-slate-600 mt-2 leading-relaxed">
              Up to 6 seats, 100 clients. Flat rate locked for life for founding practices.
            </p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="flex items-center gap-2">
              <CheckIcon />
              <span className="font-bold text-slate-900 text-sm">Growth Tier (₹21,990/year)</span>
            </div>
            <p className="text-slate-600 mt-2 leading-relaxed">
              12 seats, 150 clients. Pre-loaded statutory blueprints and department queues.
            </p>
          </div>
        </div>
      </div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-slate-50/60 py-16 sm:py-24 text-center border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl mx-auto space-y-4" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
          Run your practice from your own Google Drive.
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed [text-wrap:pretty]">
          Zero file leakage to staff laptops and 100% partner review. Keep every client docket organized in one private workspace.
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex w-full sm:w-auto h-12 items-center justify-center gap-2 bg-slate-950 px-6 text-sm font-semibold text-amber-300 transition-colors hover:bg-slate-800 shadow-sm whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900"
          >
            <span>Create workspace</span>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex w-full sm:w-auto h-12 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
          >
            <span>Find workspace</span>
          </Link>
        </div>

        <div className="text-xs text-slate-500 pt-4 flex flex-wrap items-center justify-center gap-4">
          <span>Direct Google Drive integration</span>
          <span aria-hidden="true">/</span>
          <span>Instant setup with no payment upfront</span>
        </div>
      </motion.div>
    </Container>
  </section>
);

export const MarketingFooter = () => (
  <footer className="bg-slate-950 py-12 text-slate-400 border-t border-slate-800 text-xs">
    <Container size="7xl">
      {/* Top Tier: Brand & Solutions Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="text-base font-bold tracking-tight">Docketra</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
            Practice management for Indian CAs, CSs, and compliance practices.
          </p>
        </div>

        {/* Practice Solutions Navigation */}
        <nav aria-label="Practice Solutions Navigation" className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs">
          <span className="text-slate-500 text-xs font-semibold shrink-0">
            Solutions:
          </span>
          <Link to="/solutions/company-secretaries" className="hover:text-amber-400 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-amber-400">
            Company Secretaries
          </Link>
          <Link to="/solutions/chartered-accountants" className="hover:text-amber-400 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-amber-400">
            Chartered Accountants
          </Link>
          <Link to="/solutions/corporate-legal-teams" className="hover:text-amber-400 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-amber-400">
            Corporate Legal
          </Link>
          <Link to="/compare/docketra-vs-excel-whatsapp" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-amber-400">
            vs. Excel &amp; WhatsApp
          </Link>
        </nav>
      </div>

      {/* Bottom Tier: Copyright, Drive Promise, and Legal Links */}
      <div className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500">
        <p className="leading-relaxed">
          &copy; {new Date().getFullYear()} Docketra. 100% of client files stay safely inside your firm’s private Google Drive.
        </p>

        <nav aria-label="Footer legal navigation" className="flex flex-wrap items-center gap-x-6 gap-y-1 font-medium">
          <Link to="/terms" className="hover:text-slate-300 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-300">Terms</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-300">Privacy</Link>
          <Link to="/security" className="hover:text-slate-300 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-300">Security</Link>
          <Link to="/acceptable-use" className="hover:text-slate-300 transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-300">Acceptable Use</Link>
        </nav>
      </div>
    </Container>
  </footer>
);

export const LandingPageContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isTourOpen, setIsTourOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#tour' || window.location.search.includes('tour=');
  });

  useEffect(() => {
    if (!location.hash) return;
    if (location.hash === '#tour') {
      setIsTourOpen(true);
      return;
    }

    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const headerOffset = 84;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
        return;
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const handleSectionNavigation = (sectionId) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });
    const el = document.getElementById(sectionId);
    if (el) {
      const headerOffset = 84;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25">
      <SeoHead
        canonicalPath="/"
        title="Docketra: The Sovereign Practice OS for Indian Professional Firms"
        description="Streamline client dockets, MCA deadlines, and team tasks in one sovereign workspace. Purpose-built for Indian CS, CA, and legal firms. 100% Google Drive BYOS. Start your free pilot."
      />
      <PublicMarketingHeader />
      <HeroSection onOpenTour={() => setIsTourOpen(true)} />
      <HighlightsStrip />
      <PracticeMatrixSection />
      <ProblemSection />
      <HowItWorksSection />
      <TrustSection />
      <PilotReadinessSection />
      <FinalCtaSection />
      <MarketingFooter />
      <LandingProductTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToSection={handleSectionNavigation}
      />
    </div>
  );
};

export default LandingPageContent;
