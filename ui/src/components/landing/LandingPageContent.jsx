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
    role: 'Corporate Compliance & Governance',
    stat: '100% MCA V3 Ready',
    description: 'Master annual returns, director KYC, board resolutions, and charge registrations without spreadsheet chaos.',
    capabilities: [
      { form: 'AOC-4 & MGT-7', label: 'Annual filing checklists with pre-scrutiny readiness' },
      { form: 'DIR-3 KYC & DSC', label: 'Director identification and token validity tracking' },
      { form: 'PAS-3 & CHG-1', label: 'Allotment and charge creation audit trail' },
      { form: 'ROC Radar', label: 'Automated warnings before compounding late fee penalties' },
    ],
    link: '/solutions/company-secretaries',
  },
  {
    id: 'ca',
    title: 'Chartered Accountants (CA)',
    role: 'Taxation, GST & Statutory Audit',
    stat: 'Zero Leakage Drive BYOS',
    description: 'Keep working papers, challans, and 3CD audit schedules protected inside your private Google Drive enclave.',
    capabilities: [
      { form: 'Tax Audit 3CD', label: 'Clause-by-clause trainee checklists with maker-checker sign-off' },
      { form: 'GSTR-3B & 9', label: 'Monthly reconciliation queues and challan storage' },
      { form: 'Client Upload Link', label: 'One-click upload link so clients send bills with zero login hassle' },
      { form: 'Trainee Shield', label: 'Article clerks cannot dump client financial ledgers onto personal disks' },
    ],
    link: '/solutions/chartered-accountants',
  },
  {
    id: 'legal',
    title: 'Corporate Legal Teams',
    role: 'Litigation, Contracts & Regulatory Advisory',
    stat: 'Immutable Peer-Review Audit',
    description: 'Track tribunal dates, company petitions, notice replies, and client dockets in a unified sovereign vault.',
    capabilities: [
      { form: 'NCLT & HC Radar', label: 'Next hearing tracking with order sheet repository' },
      { form: 'Docket Folders', label: 'Case briefs, vakalatnamas, and rejoinders auto-structured in Drive' },
      { form: 'Partner Approval', label: 'Mandatory QC sign-off on legal notices and plaints' },
      { form: 'Client Memory', label: 'Entity master registry with director and signatory dossiers' },
    ],
    link: '/solutions/corporate-legal-teams',
  },
];

const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-slate-50/60 pt-20 pb-14 sm:pt-24 sm:pb-16 md:pt-24 md:pb-20 border-b border-slate-200">
    <Container size="7xl" className="relative">
      <div className="grid items-center gap-8 lg:gap-10 lg:grid-cols-2">
        <motion.div {...REVEAL} className="space-y-4">
          {/* Eyebrow Kicker */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>THE SOVEREIGN PRACTICE OS</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <span>100% Google Drive BYOS • Zero File Leakage</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-extrabold leading-[1.14] tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
            The Sovereign Practice OS for Indian Professional Firms.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-xl">
            Keep all client dockets, MCA deadlines, and team worklists inside your firm’s private Google Drive. 
            Trainee Laptop Shield prevents junior local downloads. 100% partner SQC-1 sign-off before government portal submission.
          </p>

          <div className="p-3 border-l-2 border-amber-500 bg-amber-50/70 text-slate-900 text-xs font-mono">
            <span className="font-bold text-amber-900">ICAI / ICSI Practice Standard:</span> Zero files touch external servers. All working papers remain in your firm’s custody.
          </div>

          {/* Tailored Practice Selector */}
          <div className="pt-1 pb-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              Practice Enclaves:
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                to="/solutions/company-secretaries"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-2xs"
              >
                <span>Company Secretaries (PCS)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/chartered-accountants"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-2xs"
              >
                <span>Chartered Accountants (CA)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/corporate-legal-teams"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-slate-400 hover:text-slate-950 transition-colors shadow-2xs"
              >
                <span>Corporate Legal Teams</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/compare/docketra-vs-excel-whatsapp"
                className="inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50/60 px-2.5 py-1 text-xs font-medium text-amber-900 hover:border-amber-400 hover:text-amber-950 transition-colors"
              >
                <span>vs. Excel & WhatsApp</span>
                <span className="text-amber-600">→</span>
              </Link>
            </div>
          </div>

          {/* Primary Action Cluster */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-bold text-amber-400 whitespace-nowrap transition-colors hover:bg-slate-800 shadow-sm shrink-0"
            >
              <span>Create firm workspace</span>
              <span>→</span>
            </Link>

            <Link
              to="/find-workspace"
              className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs shrink-0"
            >
              <span>Find workspace</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              <span>Interactive product tour</span>
            </button>
          </div>

          {/* Operational Guarantees */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>₹0 Sandbox for up to 5 clients</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Connects directly to your Google Drive</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>No credit card required</span>
            </span>
          </div>
        </motion.div>

        {/* Right Hero: The Interactive Workstation Canvas */}
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

const SubHeroMetricsStrip = () => (
  <section className="border-b border-slate-200 bg-white py-6">
    <Container size="7xl">
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            stat: '100% BYOS Custody',
            label: 'Private Google Drive',
            desc: 'Files save strictly into your own Drive. Zero third-party cloud custody.',
            badge: 'DRIVE.FILE SCOPE',
          },
          {
            stat: 'Download Sealed',
            label: 'Trainee Laptop Shield',
            desc: 'Clerks view documents in-browser; raw downloads to trainee laptops are blocked.',
            badge: 'ZERO LEAKAGE',
          },
          {
            stat: '100% Partner Sign',
            label: 'SQC-1 4-Eye Review',
            desc: 'Mandatory partner verification before any form is submitted to government portals.',
            badge: 'PEER-REVIEW AUDIT',
          },
          {
            stat: '1-Click Recovery',
            label: 'Drive Tamper Guard',
            desc: 'Accidental folder moves or trashes in Google Drive are restored with zero data loss.',
            badge: 'SELF-HEALING',
          },
        ].map((item, idx) => (
          <div key={idx} className="border-l-2 border-slate-200 pl-4 py-1 hover:border-slate-900 transition-colors">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
              <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded-xs border border-amber-200">
                {item.badge}
              </span>
            </div>
            <p className="text-base font-extrabold text-slate-950 mt-1">{item.stat}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
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
    <section id="product" className="scroll-mt-16 bg-slate-50/50 py-16 sm:py-20 border-b border-slate-200">
      <Container size="7xl">
        <motion.div className="max-w-3xl" {...REVEAL}>
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Practice Matrix</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
            Tailored Regulatory Engines for Indian Practices
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            Generic project management tools fail because they do not understand MCA V3 forms, Form 3CD clauses, GSTR-3B cutoffs, or ICAI peer review standards. Docketra is built specifically for your practice domain.
          </p>
        </motion.div>

        {/* Practice Selector Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {PRACTICE_PILLARS.map((pillar) => (
            <button
              key={pillar.id}
              type="button"
              onClick={() => setActiveTab(pillar.id)}
              className={`px-4 py-2.5 text-xs font-bold rounded-sm border transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === pillar.id
                  ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
              }`}
            >
              <span>{pillar.title}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border ${
                activeTab === pillar.id
                  ? 'border-amber-400 bg-slate-900 text-amber-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                {pillar.stat}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Practice Enclave Display */}
        <div className="mt-6 border border-slate-200 bg-white p-6 sm:p-8 rounded-lg shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded-xs">
                {currentPillar.role}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-2">
                {currentPillar.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {currentPillar.description}
              </p>
            </div>
            <Link
              to={currentPillar.link}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-slate-50 text-slate-800 font-semibold text-xs rounded hover:bg-slate-100 hover:border-slate-400 transition-colors self-start lg:self-auto shrink-0 shadow-2xs"
            >
              <span>Explore {currentPillar.title.split(' ')[0]} Workflows</span>
              <span>→</span>
            </Link>
          </div>

          <div className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {currentPillar.capabilities.map((cap, idx) => (
              <div key={idx} className="border border-slate-200 bg-slate-50/60 p-4 rounded-md space-y-1 hover:border-slate-300 transition-colors">
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

        {/* Shared Operational Architecture Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Client Memory Dossier',
              body: 'Centralize CIN, PAN, TAN, DIN, authorized signatories, and DSC expiry in one master card with 1-click copy for portal filing.',
              tag: '1-Click Portal Copy',
            },
            {
              title: 'Zero-Login Client Upload Link',
              body: 'Send clients a secure WhatsApp-friendly link to drop bank statements, bills, and challans. No client account creation required.',
              tag: 'No Client Password Friction',
            },
            {
              title: 'Personal Worklists & Shared Queues',
              body: 'Staff and article clerks receive precise daily worklists, while practice managers route complex files through department workbaskets.',
              tag: 'Zero Dropped Deadlines',
            },
            {
              title: 'Mandatory QC & 4-Eye Review',
              body: 'Draft forms and working papers cannot be marked complete without partner verification, guaranteeing strict compliance.',
              tag: 'Partner Sign-off Required',
            },
            {
              title: 'Pre-loaded Statutory Blueprints',
              body: 'Standardized workflows for MCA annual filings, Form 3CD clauses, GSTR reconciliations, and DIR-3 KYC so article clerks work independently.',
              tag: 'Trainee Standardization',
            },
            {
              title: 'Sovereign Google Drive Enclave',
              body: 'Client documents never leave your firm’s Google Drive. Even if you cancel Docketra, 100% of your records stay organized in your own folders.',
              tag: 'Permanent Firm Custody',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-400 transition-colors rounded shadow-2xs"
            >
              <div>
                <h4 className="text-sm font-bold text-slate-950">{feature.title}</h4>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{feature.body}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <span className="text-amber-600 font-bold">✓</span>
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
  <section id="why" className="scroll-mt-16 bg-white py-16 sm:py-20 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Why Practices Switch
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Why Excel & WhatsApp Fail Busy Professional Firms
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          WhatsApp mixes confidential PANs and bank statements with personal chats. Excel cannot prevent trainee data leakage, track MCA late fees, or enforce partner sign-offs.
        </p>
      </motion.div>

      <div className="mt-8">
        <ComplianceVsGenericComparison />
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-slate-50/50 py-16 sm:py-20 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Statutory Lifecycle
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          How Work Moves Through Docketra
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          A disciplined 4-stage pipeline designed around the Indian statutory maker-checker standard.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: '01',
            title: 'Intake & Docket Opening',
            desc: 'Open a client docket in 30 seconds. The sandboxed Google Drive folder is provisioned instantly.',
            detail: 'Restricted drive.file isolation',
          },
          {
            step: '02',
            title: 'Trainee Workbasket',
            desc: 'Assign filing steps to associates or article clerks with pre-loaded statutory checklists and cutoffs.',
            detail: 'Download Shield prevents local dumps',
          },
          {
            step: '03',
            title: 'Drive Working Papers',
            desc: 'Working papers and draft forms save directly into your private Drive. Clients upload via zero-login links.',
            detail: 'Zero files touch external servers',
          },
          {
            step: '04',
            title: 'Partner SQC-1 Sign-off',
            desc: 'Managing partner verifies draft challans, applies the audit seal, and marks the matter complete for portal submission.',
            detail: 'ICAI/ICSI inspection-ready audit log',
          },
        ].map((item) => (
          <div key={item.step} className="border border-slate-200 bg-white p-5 hover:border-slate-400 transition-colors rounded shadow-2xs">
            <span className="font-mono text-sm font-extrabold text-amber-600 tracking-wider">
              STAGE {item.step}
            </span>
            <h3 className="mt-2 text-sm font-bold text-slate-950">{item.title}</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 font-mono text-[10px] text-slate-500 font-semibold">
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-[#080C14] py-16 sm:py-20 text-white border-b border-slate-800">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1">
          Data Sovereignty & Security Fortress
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Your Client Files Stay in Your Firm’s Own Google Drive
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Docketra never stores client documents on multi-tenant third-party servers. We manage the workflow metadata while 100% of confidential files remain inside your Google perimeter.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Google Drive Isolation</h3>
            <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">RESTRICTED</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Docketra strictly uses Google’s restricted <code className="text-amber-300 text-[11px]">drive.file</code> scope. It can only open the specific /Docketra/ folder it created, with zero access to your existing personal files.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Trainee Laptop Shield</h3>
            <span className="font-mono text-[9px] text-amber-400 bg-amber-950 px-1.5 py-0.2 rounded border border-amber-800">ANTI-THEFT</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Article assistants view working papers inside Docketra’s protected viewer. Direct downloads of client PAN, ITR, and financial files to personal laptops are blocked.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Drive Tamper Guard</h3>
            <span className="font-mono text-[9px] text-sky-400 bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800">SELF-HEALING</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            If a clerk accidentally moves or trashes a folder inside Google Drive, Docketra detects it instantly and restores the folder and file links in 1 click with 0 data loss.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-2 hover:border-slate-700 transition-colors rounded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">SQC-1 Peer-Review Trail</h3>
            <span className="font-mono text-[9px] text-purple-400 bg-purple-950 px-1.5 py-0.2 rounded border border-purple-800">ICAI / ICSI</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Complete 4-eye maker-checker audit log. Shows exactly who prepared the filing and when the partner signed off, ready for peer review inspections.
          </p>
        </div>
      </div>
    </Container>
  </section>
);

const PilotReadinessSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-white py-16 sm:py-20 border-b border-slate-200">
    <Container size="7xl">
      <div className="border border-slate-300 bg-slate-50/70 p-6 sm:p-8 rounded-lg shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Pilot Readiness & Transparent Pricing</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Start Using Docketra for Your Firm in 5 Minutes
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create your firm workspace, invite your team, and manage your first 5 clients for ₹0. Upgrade to Pioneer or Growth whenever you expand.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-colors hover:bg-slate-800 shrink-0 shadow-sm"
            >
              <span>Create workspace</span>
              <span>→</span>
            </Link>
            <Link
              to="/pricing"
              className="inline-flex w-full sm:w-auto h-11 items-center justify-center border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shrink-0 shadow-2xs"
            >
              <span>View all plans & bonuses</span>
            </Link>
          </div>
        </div>

        {/* 4 Value Pillars */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded">
            <span className="text-emerald-600 font-extrabold text-sm">✓</span>
            <div>
              <span className="font-bold text-slate-900 block">Free Pilot (₹0 forever):</span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">2 seats, 5 clients. Official sandbox for Google Drive safety & junior download blocks.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded">
            <span className="text-amber-600 font-extrabold text-sm">✓</span>
            <div>
              <span className="font-bold text-slate-900 block">Pioneer 30 (₹12,990/year):</span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">Up to 5 seats, 50 clients. Flat rate locked for life for founding practices.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded">
            <span className="text-indigo-600 font-extrabold text-sm">★</span>
            <div>
              <span className="font-bold text-slate-900 block">Growth Tier (₹21,990/year):</span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">12 seats, 150 clients. Pre-loaded statutory blueprints and department queues.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded">
            <span className="text-emerald-600 font-extrabold text-sm">✓</span>
            <div>
              <span className="font-bold text-slate-900 block">30-Day Guarantee:</span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">100% refund if it does not save 10 hours a week. All files stay in your Drive.</p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-slate-50/60 py-16 sm:py-20 text-center border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl mx-auto space-y-4" {...REVEAL}>
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Sovereign Practice Management</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight">
          Run your practice from your own Google Drive.
        </h2>
        <p className="text-sm font-semibold text-slate-900">
          Zero file leakage, 100% partner review.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Start with one workspace, invite your team, and eliminate scattered WhatsApp client files today.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 bg-slate-950 px-6 text-xs font-bold text-amber-400 transition-colors hover:bg-slate-800 shadow-sm"
          >
            <span>Create workspace</span>
            <span>→</span>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
          >
            <span>Find workspace</span>
          </Link>
        </div>

        <div className="font-mono text-[11px] text-slate-500 pt-3 flex flex-wrap items-center justify-center gap-4">
          <span>No credit card required</span>
          <span>•</span>
          <span>Connect your own Google Drive</span>
          <span>•</span>
          <span>2-minute setup</span>
        </div>
      </motion.div>
    </Container>
  </section>
);

export const MarketingFooter = () => (
  <footer className="bg-slate-950 py-12 text-slate-400 border-t border-slate-800 text-xs">
    <Container size="7xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 text-white font-semibold">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-sm font-bold tracking-tight">Docketra</span>
          <span className="text-slate-500 text-[11px] font-mono">| The Sovereign Practice OS for Indian Professional Firms</span>
        </div>

        {/* Practice Solutions Navigation */}
        <nav aria-label="Practice Solutions Navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
          <span className="text-slate-500 font-mono font-bold uppercase tracking-wider text-[10px]">Solutions:</span>
          <Link to="/solutions/company-secretaries" className="hover:text-amber-400 transition-colors">Company Secretaries</Link>
          <Link to="/solutions/chartered-accountants" className="hover:text-amber-400 transition-colors">Chartered Accountants</Link>
          <Link to="/solutions/corporate-legal-teams" className="hover:text-amber-400 transition-colors">Corporate Legal</Link>
          <Link to="/compare/docketra-vs-excel-whatsapp" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">vs. Excel & WhatsApp</Link>
        </nav>

        <nav aria-label="Footer legal navigation" className="flex items-center gap-5 font-medium">
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/security" className="hover:text-white transition-colors">Security</Link>
          <Link to="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use</Link>
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
      <SubHeroMetricsStrip />
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
