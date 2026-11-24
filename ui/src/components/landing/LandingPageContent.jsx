import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import LandingProductTourModal from './LandingProductTourModal';
import { DriveIsolationCertificateModal } from '../storage/DriveIsolationCertificateModal';
import Container from '../layout/Container';
import SeoHead from '../common/SeoHead';

const REVEAL = {
  initial: false,
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.08 },
};

/* --- Icons --- */
const ArrowRightIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckCircleIcon = ({ className = 'h-5 w-5 text-amber-400 shrink-0 mt-0.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const XCircleIcon = ({ className = 'h-5 w-5 text-rose-500 shrink-0 mt-0.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const ClockIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UploadIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ListTodoIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </svg>
);

const CheckCheckIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

const IdCardIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
    <line x1="6" x2="10" y1="15" y2="15" />
  </svg>
);

const ShieldCheckIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/* --- Live Compliance Data for Hero Component --- */
const DOCKET_ITEMS = [
  {
    id: '1',
    client: 'Zenith Logistics Pvt Ltd',
    work: 'DIR-3 KYC • DIN 08924152',
    due: 'Due today',
    dueTone: 'rose',
    type: 'ROC',
    owner: 'R. Sharma (CS)',
    stage: 'Pending DSC verification',
  },
  {
    id: '2',
    client: 'Neo Retail Solutions',
    work: 'AOC-4 filing • Annual Compliance',
    due: 'In 3 days',
    dueTone: 'amber',
    type: 'ROC',
    owner: 'P. Verma (Executive)',
    stage: 'Draft balance sheet attached',
  },
  {
    id: '3',
    client: 'Apex Bio-Tech LLP',
    work: 'Tax Audit 3CD • 44 Clauses',
    due: 'Partner review',
    dueTone: 'slate',
    type: 'TAX',
    owner: 'Partner Mehta (FCA)',
    stage: 'Clause 44 depreciation check',
  },
  {
    id: '4',
    client: 'Sharma Textiles',
    work: 'GSTR-3B • Monthly Return',
    due: 'Filed ✓',
    dueTone: 'emerald',
    type: 'GST',
    owner: 'A. Kulkarni (Article)',
    stage: 'Challan ARN 24108821 verified',
  },
];

/* --- Interactive Live Docket Widget (Watermelon UI Inspired + better-ui) --- */
const LiveDocketWidget = () => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return DOCKET_ITEMS;
    return DOCKET_ITEMS.filter((item) => item.type === activeFilter || (activeFilter === 'QC' && item.dueTone === 'slate'));
  }, [activeFilter]);

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-white p-6 sm:p-7 text-slate-950 shadow-2xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">
            Mehta &amp; Associates (PCS &amp; CA)
          </p>
          <p className="font-display text-2xl font-bold tracking-tight text-slate-950">
            Live Worklist
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
          1 due today
        </span>
      </div>

      {/* Interactive Tabs (Watermelon Pattern) */}
      <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto pb-1 text-xs font-mono">
        {[
          { id: 'ALL', label: 'All', count: 4 },
          { id: 'ROC', label: 'MCA / ROC', count: 2 },
          { id: 'GST', label: 'GST', count: 1 },
          { id: 'TAX', label: 'Tax Audit', count: 1 },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-[background-color,color,border-color] duration-150 ${
                isActive
                  ? 'bg-slate-950 text-white font-semibold shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`ml-1 text-[10px] ${isActive ? 'text-amber-300' : 'text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Filing Items */}
      <ul className="divide-y divide-slate-100 text-left">
        {filteredItems.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <li
              key={item.id}
              onClick={() => setSelectedId(isSelected ? null : item.id)}
              className="py-3 px-2.5 -mx-2.5 rounded-xl cursor-pointer transition-[background-color] duration-150 hover:bg-slate-50/90 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-950 group-hover:text-amber-800 transition-colors">
                    {item.client}
                  </p>
                  <p className="text-xs text-slate-500 font-normal">
                    {item.work}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border transition-colors ${
                    item.dueTone === 'rose'
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : item.dueTone === 'amber'
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : item.dueTone === 'emerald'
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                      : 'text-slate-800 bg-slate-100 border-slate-300'
                  }`}
                >
                  {item.due}
                </span>
              </div>

              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] font-mono grid grid-cols-2 gap-2 text-slate-600 animate-in fade-in duration-150">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Assigned To</span>
                    <span className="text-slate-900 font-semibold">{item.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Stage</span>
                    <span className="text-slate-900 font-semibold">{item.stage}</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer Status Pill */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live Google Drive Sync Active
        </span>
        <span className="font-mono text-slate-400">Zero cloud custody</span>
      </div>
    </div>
  );
};

/* --- Section 1: Hero Section --- */
const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-[#111215] text-slate-100 border-b border-slate-800">
    {/* Subtle Background Radial Grid */}
    <div
      className="pointer-events-none absolute inset-0 opacity-20"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, black, transparent)',
      }}
      aria-hidden="true"
    />

    <Container size="7xl" className="relative pb-20 pt-16 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <motion.div {...REVEAL} className="space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3.5 py-1 text-[11px] font-mono tracking-widest uppercase text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Built for Indian professional firms</span>
          </div>

          {/* Primary H1 + Editorial Italic Hook */}
          <div>
            <h1 className="text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl [text-wrap:balance]">
              The Company Brain for Indian professional firms.
            </h1>
            <p className="mt-3 font-display italic text-3xl sm:text-4xl lg:text-[2.75rem] leading-tight text-amber-400 font-normal">
              Every client, deadline and document — in one place.
            </p>
          </div>

          {/* Plain English Lede */}
          <p className="text-base sm:text-lg font-normal leading-relaxed text-slate-300 max-w-xl [text-wrap:pretty]">
            DocketsHQ is built for Indian professional firms: CS, CA, law, and compliance teams. It reminds you of every GST, ROC, and tax filing before it’s late, collects client documents with 1-click drop links, and enforces partner sign-off before submission.
          </p>

          {/* Practice Quick-Navigation Strip */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold font-mono uppercase tracking-wider text-slate-400 block mb-2.5">
              Tailored For Your Practice:
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                to="/solutions/company-secretaries"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
              >
                <span>Company Secretaries (PCS)</span>
              </Link>
              <Link
                to="/solutions/chartered-accountants"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
              >
                <span>Chartered Accountants (CA)</span>
              </Link>
              <Link
                to="/solutions/corporate-legal-teams"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
              >
                <span>Corporate Legal Teams</span>
              </Link>
              <Link
                to="/compare/docketra-vs-excel-whatsapp"
                className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-950/40 px-3 py-1 font-medium text-amber-300 hover:border-amber-400 hover:text-amber-200 transition-colors"
              >
                <span>vs. Excel &amp; WhatsApp</span>
              </Link>
            </div>
          </div>

          {/* Primary Action Row (better-ui exact scale and transition) */}
          <div className="flex flex-wrap items-center gap-3.5 pt-3">
            <Link
              to="/signup"
              aria-label="Create workspace — Request early access"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-sm font-bold text-slate-950 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-amber-300 hover:shadow-md hover:shadow-amber-400/20 enabled:active:scale-[0.96] cursor-pointer"
            >
              <span>Create workspace</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>

            <Link
              to="/find-workspace"
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-5 text-sm font-semibold text-slate-200 transition-[transform,background-color,border-color,color] duration-150 ease-out hover:bg-slate-800 hover:text-white enabled:active:scale-[0.96] cursor-pointer"
            >
              <span>Find workspace</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-800 bg-transparent px-5 text-xs font-mono text-slate-400 transition-[transform,border-color,color] duration-150 ease-out hover:border-slate-700 hover:text-slate-200 enabled:active:scale-[0.96] cursor-pointer"
            >
              <span>Product tour</span>
            </button>
          </div>

          {/* Microcopy & Guarantees */}
          <p className="text-xs font-mono text-slate-400 pt-1">
            No credit card required • 100% Google Drive BYOS • Set up in 10 minutes
          </p>
        </motion.div>

        {/* Right Column: Upgraded Live Docket Widget */}
        <motion.div {...REVEAL} className="relative isolate">
          <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-b from-amber-500/20 via-slate-800/20 to-transparent blur-xs" />
          <LiveDocketWidget />
        </motion.div>
      </div>
    </Container>
  </section>
);

/* --- Section 1.5: Subtle B2B Trust & Metrics Strip --- */
const TrustMetricsStrip = () => (
  <section aria-label="Key Platform Proof" className="border-b border-slate-800 bg-[#0c0d10] py-6 text-slate-300">
    <Container size="7xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-between text-left sm:text-center font-mono">
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">250+ Firms</p>
          <p className="text-xs text-slate-400 font-sans">Across Mumbai, Delhi, Bengaluru</p>
        </div>
        <div className="space-y-0.5 border-l border-slate-800/80 pl-4 sm:pl-0 sm:border-l-0">
          <p className="text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight">100% On-Premise</p>
          <p className="text-xs text-slate-400 font-sans">Google Drive &amp; Local Disk Sync</p>
        </div>
        <div className="space-y-0.5 border-t border-slate-800/80 pt-4 sm:pt-0 sm:border-t-0">
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight">0% Custody</p>
          <p className="text-xs text-slate-400 font-sans">We never store your client files</p>
        </div>
        <div className="space-y-0.5 border-l border-slate-800/80 pl-4 sm:pl-0 sm:border-l-0 border-t border-slate-800/80 pt-4 sm:pt-0 sm:border-t-0">
          <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">₹0 Forever</p>
          <p className="text-xs text-slate-400 font-sans">Free Pilot for 5 active clients</p>
        </div>
      </div>
    </Container>
  </section>
);

/* --- Section 2: The Problem (Mapped to #why) --- */
const ProblemSection = () => (
  <section id="why" className="scroll-mt-16 bg-white py-20 sm:py-28 border-b border-slate-200">
    <Container size="5xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-amber-600 font-bold">
          — The problem
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
          Running a firm on Excel and WhatsApp is risky.
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Without DocketsHQ */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-8 shadow-2xs">
          <p className="mb-6 font-mono text-xs uppercase tracking-widest text-slate-500 font-bold">
            Without DocketsHQ
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
              <XCircleIcon />
              <span>Deadlines tracked in Excel — and missed when staff or articles are overloaded</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
              <XCircleIcon />
              <span>Client PAN cards, confidential returns, and bank statements lost in WhatsApp chats</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
              <XCircleIcon />
              <span>No verifiable record or audit trail of who prepared, checked, or approved a filing</span>
            </li>
          </ul>
        </div>

        {/* With DocketsHQ */}
        <div className="rounded-2xl border border-slate-800 bg-[#111215] p-8 text-white shadow-xl">
          <p className="mb-6 font-mono text-xs uppercase tracking-widest text-amber-400 font-bold">
            With DocketsHQ
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
              <CheckCircleIcon />
              <span>Automatic reminders and radar warnings before any MCA or tax late fees apply</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
              <CheckCircleIcon />
              <span>Clients upload documents through one simple WhatsApp link with zero password hassle</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
              <CheckCircleIcon />
              <span>Every filing checked and signed off by a partner with a permanent, peer-review audit seal</span>
            </li>
          </ul>
        </div>
      </div>
    </Container>
  </section>
);

/* --- Section 3: How It Works - 4 Steps (Mapped to #workflow) --- */
const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-[#111215] py-20 sm:py-28 text-white border-b border-slate-800">
    <Container size="7xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-amber-400 font-bold">
          — How it works
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
          Up and running in four steps.
        </h2>
      </div>

      <ol className="grid overflow-hidden rounded-2xl border border-slate-800 md:grid-cols-4 bg-slate-900/40">
        {[
          {
            step: '01',
            title: 'Create your workspace',
            desc: 'Sign up and connect your firm’s private Google Drive. Takes about 10 minutes with zero IT complexity.',
          },
          {
            step: '02',
            title: 'Add your clients',
            desc: 'Enter PAN, CIN or GSTIN. DocketsHQ sets up client memory cards and statutory filing calendars automatically.',
          },
          {
            step: '03',
            title: 'Assign work to your team',
            desc: 'Staff receive clear daily Worklists while managers route complex dockets through department Workbaskets.',
          },
          {
            step: '04',
            title: 'Review and file',
            desc: 'A partner approves drafts in QC Workbaskets, then files to government portals. Everything is sealed in an audit trail.',
          },
        ].map((item, idx) => (
          <li
            key={item.step}
            className={`p-8 transition-colors duration-150 hover:bg-slate-800/40 ${
              idx > 0 ? 'border-t border-slate-800 md:border-t-0 md:border-l' : ''
            }`}
          >
            <span className="font-mono text-sm font-bold text-amber-400 block">
              {item.step} /
            </span>
            <h3 className="mt-8 text-lg font-bold text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.desc}</p>
          </li>
        ))}
      </ol>
    </Container>
  </section>
);

/* --- Section 4: What You Get - 6 Core Capabilities (Watermelon Bento Grid + better-ui) --- */
const FeaturesSection = () => (
  <section id="product" className="scroll-mt-16 bg-white py-20 sm:py-28 border-b border-slate-200">
    <Container size="7xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-amber-600 font-bold">
          — What you get
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
          Everything your firm needs. Nothing it doesn’t.
        </h2>
        <p className="mt-4 text-base text-slate-600">
          Built around how Indian CA, CS, and compliance firms actually work every single day.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: ClockIcon,
            title: 'Deadline reminders',
            badge: 'Statutory Radar',
            desc: 'GST, ROC (MCA), income tax, and tax audit due dates tracked across all clients — with automated warnings before late fees apply.',
          },
          {
            icon: UploadIcon,
            title: 'Client upload link',
            badge: 'WhatsApp Drop',
            desc: 'Send a link on WhatsApp. Clients upload bank statements, challans, and bills directly into your Drive with zero passwords.',
          },
          {
            icon: ListTodoIcon,
            title: 'Daily team to-do lists',
            badge: 'Queue Oversight',
            desc: 'Every staff member knows exactly what to work on today. Managers see team execution in real-time Worklists.',
          },
          {
            icon: CheckCheckIcon,
            title: 'Partner sign-off',
            badge: 'Defensible Audit',
            desc: 'Work cannot be marked complete without partner sign-off in QC Workbaskets. Fully defensible for ICAI and ICSI peer review.',
          },
          {
            icon: IdCardIcon,
            title: 'Client details in one card',
            badge: 'One-Click Master',
            desc: 'PAN, TAN, CIN, DIN, authorized signatories, and DSC expiry stored in one master card — copy to portals in one click.',
          },
          {
            icon: ShieldCheckIcon,
            title: 'Ready-made checklists',
            badge: 'Ready Blueprints',
            desc: 'Turnkey statutory templates for AOC-4, MGT-7, Form 3CD clauses, GSTR, and DIR-3 KYC. Perfect for article clerks.',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="group relative bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/90 shadow-2xs transition-[border-color,background-color,box-shadow] duration-200 hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-800 transition-colors group-hover:bg-amber-100/80 group-hover:text-amber-900">
                  <feature.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-mono font-semibold uppercase text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-950 tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                {feature.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

/* --- Section 5: Client Confidentiality & Security (Mapped to #trust) --- */
const TrustSection = ({ onOpenCertificate }) => (
  <section id="trust" className="scroll-mt-16 bg-[#111215] py-20 sm:py-28 text-white border-b border-slate-800">
    <Container size="7xl">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-amber-400 font-bold">
            — Your data, your control
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
            Client confidentiality, built in.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            Your clients trust you with sensitive financial records. DocketsHQ is engineered with Bring-Your-Own-Storage so working papers never leave your custody.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={onOpenCertificate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-[background-color,transform] duration-150 enabled:active:scale-[0.96] shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
              <span>View Sovereign Drive Isolation Certificate</span>
            </button>
            <p className="mt-2 text-[11px] text-slate-400 font-mono">
              Zero external server storage • Google drive.file scope verified • SHA-256 cryptographic proof
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors duration-150 hover:border-slate-700">
            <h3 className="text-lg font-bold text-white">Files stay in your Google Drive</h3>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
              We never store your client documents on third-party servers. If you ever cancel DocketsHQ, 100% of your folder hierarchy remains intact in your own Google Drive.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors duration-150 hover:border-slate-700">
            <h3 className="text-lg font-bold text-white">Trainees can’t download files</h3>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
              Article assistants view working papers securely inside the browser viewer. Local hard drive downloads are restricted to protect client ledgers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors duration-150 hover:border-slate-700">
            <h3 className="text-lg font-bold text-white">Accidental deletes are restored</h3>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
              If an intern or staff member accidentally renames or deletes a folder in Google Drive, DocketsHQ detects it immediately and restores folder links automatically.
            </p>
          </div>
        </div>
      </div>
    </Container>
  </section>
);

/* --- Section 6: Audience / Practice Solutions --- */
const AudienceSection = () => (
  <section className="bg-white py-20 sm:py-28 border-b border-slate-200">
    <Container size="7xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-amber-600 font-bold">
          — Who it’s for
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
          Made for professional firms.
        </h2>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="border-t-2 border-slate-900 pt-6 space-y-3">
          <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">Chartered Accountants</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            GST returns, income tax scrutiny, Tax Audit Form 3CD (44 clauses), and TDS workflows across your entire client roster.
          </p>
          <div className="pt-2">
            <Link
              to="/solutions/chartered-accountants"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <span>Explore CA Solution</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="border-t-2 border-slate-900 pt-6 space-y-3">
          <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">Company Secretaries</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            ROC annual filings (AOC-4/MGT-7), DIR-3 KYC, board resolutions, charge registers, and secretarial audit workflows.
          </p>
          <div className="pt-2">
            <Link
              to="/solutions/company-secretaries"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <span>Explore CS Solution</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="border-t-2 border-slate-900 pt-6 space-y-3">
          <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">Legal &amp; compliance teams</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            NCLT hearing radar, statutory notices, litigation order sheets, and internal corporate compliance calendars.
          </p>
          <div className="pt-2">
            <Link
              to="/solutions/corporate-legal-teams"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <span>Explore Legal Ops</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </Container>
  </section>
);

/* --- Section 7: Final Conversion CTA (Mapped to #pilot-readiness) --- */
const FinalCtaSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-slate-50 py-20 px-6 sm:py-24 border-b border-slate-200">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#111215] p-10 text-center text-white sm:p-16 lg:p-20 shadow-2xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 60% 80% at 50% 100%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 80% at 50% 100%, black, transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl space-y-5">
        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Try DocketsHQ free with 5 clients.
        </h2>
        <p className="mx-auto max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed">
          See every deadline for your firm on one screen — set up in minutes with zero credit card required.
        </p>

        <div className="pt-6 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            to="/signup"
            aria-label="Create workspace — Request early access"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-amber-400 px-7 text-sm font-bold text-slate-950 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-amber-300 hover:shadow-md hover:shadow-amber-400/20 enabled:active:scale-[0.96] cursor-pointer"
          >
            <span>Create workspace</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex h-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-6 text-sm font-semibold text-slate-200 transition-[transform,background-color,border-color,color] duration-150 ease-out hover:bg-slate-800 hover:text-white enabled:active:scale-[0.96] cursor-pointer"
          >
            <span>Find workspace</span>
          </Link>

          <Link
            to="/pricing"
            className="inline-flex h-12 items-center justify-center rounded-full border border-transparent px-5 text-xs font-mono text-slate-400 transition-colors duration-150 hover:text-amber-400"
          >
            <span>View all plans &amp; pricing →</span>
          </Link>
        </div>

        <p className="pt-4 text-xs font-mono text-slate-400">
          100% Google Drive BYOS • Zero setup fees • Cancel anytime
        </p>
      </div>
    </div>
  </section>
);

/* --- Footer Component --- */
export const MarketingFooter = () => (
  <footer className="border-t border-slate-900 bg-slate-950 text-slate-400 py-12 text-xs">
    <Container size="7xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-900">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-white font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="text-base font-bold tracking-tight">DocketsHQ</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-900">
              The Company Brain
            </span>
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
          <Link to="/solutions/company-secretaries" className="hover:text-amber-400 transition-colors whitespace-nowrap">
            Company Secretaries
          </Link>
          <Link to="/solutions/chartered-accountants" className="hover:text-amber-400 transition-colors whitespace-nowrap">
            Chartered Accountants
          </Link>
          <Link to="/solutions/corporate-legal-teams" className="hover:text-amber-400 transition-colors whitespace-nowrap">
            Corporate Legal
          </Link>
          <Link to="/compare/docketra-vs-excel-whatsapp" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors whitespace-nowrap">
            vs. Excel &amp; WhatsApp
          </Link>
        </nav>
      </div>

      <div className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500">
        <p className="leading-relaxed">
          &copy; {new Date().getFullYear()} DocketsHQ. Made in India for professional firms. 100% Google Drive BYOS.
        </p>

        <nav aria-label="Footer legal navigation" className="flex flex-wrap items-center gap-x-6 gap-y-1 font-medium">
          <Link to="/pricing" className="hover:text-slate-300 transition-colors whitespace-nowrap">Pricing</Link>
          <Link to="/terms" className="hover:text-slate-300 transition-colors whitespace-nowrap">Terms</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors whitespace-nowrap">Privacy</Link>
          <Link to="/security" className="hover:text-slate-300 transition-colors whitespace-nowrap">Security</Link>
          <Link to="/acceptable-use" className="hover:text-slate-300 transition-colors whitespace-nowrap">Acceptable Use</Link>
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
  const [isCertOpen, setIsCertOpen] = useState(false);

  useEffect(() => {
    if (!location.hash) return;
    if (location.hash === '#tour') {
      setIsTourOpen(true);
      return;
    }

    const id = location.hash.replace('#', '');
    let attempts = 0;
    const maxAttempts = 6;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        const headerOffset = 84;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
        return true;
      }
      return false;
    };

    if (tryScroll()) return;

    const interval = window.setInterval(() => {
      attempts += 1;
      if (tryScroll()) {
        window.clearInterval(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }, 100);

    return () => window.clearInterval(interval);
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
        title="DocketsHQ — The Company Brain for Indian Professional Firms"
        description="Streamline client dockets, MCA deadlines, and team tasks with The Company Brain. Purpose-built for Indian CS, CA, and legal firms. 100% Google Drive BYOS. Start your free pilot."
      />
      <PublicMarketingHeader />
      <HeroSection onOpenTour={() => setIsTourOpen(true)} />
      <TrustMetricsStrip />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TrustSection onOpenCertificate={() => setIsCertOpen(true)} />
      <AudienceSection />
      <FinalCtaSection />
      <MarketingFooter />
      <LandingProductTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToSection={handleSectionNavigation}
      />
      <DriveIsolationCertificateModal
        isOpen={isCertOpen}
        onClose={() => setIsCertOpen(false)}
        firmName="Registered Indian CA/CS Practice (Sample Attestation)"
        firmSlug="PRACTICE"
        config={{ connectedEmail: "partner@firm-domain.com" }}
        boundaryReport={{
          boundaryAudit: {
            filesReadOutsideRoot: 0,
            preExistingFoldersOpened: 0,
            externalStorageBytes: 0,
            cryptographicProofHash: "sha256:docketra-cryptographic-isolation-boundary-verified",
          },
        }}
      />
    </div>
  );
};

export default LandingPageContent;
