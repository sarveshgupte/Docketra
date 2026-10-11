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
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.08 },
};

const HERO_BADGES = [
  {
    label: 'Dockets',
    desc: 'Matters & Filings',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Worklists',
    desc: 'Daily Staff Tasks',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Workbaskets',
    desc: 'Team Queues',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Quality Control',
    desc: 'Partner Sign-off',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    desc: 'Firm Overview',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Audit Trails',
    desc: 'Activity History',
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-slate-50/50 pt-20 pb-10 sm:pt-24 md:pt-24 md:pb-14 border-b border-slate-200/80">
    <Container size="7xl" className="relative">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
        <motion.div {...REVEAL} className="space-y-4">
          {/* Eyebrow Kicker */}
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            <span className="h-1.5 w-1.5 rounded-xs bg-amber-500" />
            <span>Built for Indian professional firms</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
            The Company Brain for Indian professional firms.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-xl">
            Docketra connects client memory, dockets, deadlines, QC, worklists, and reports in one firm workspace.
          </p>

          <p className="text-xs font-medium text-slate-900">
            For CS, CA, law, and compliance teams that cannot afford missing context.
          </p>

          {/* Dedicated Practice Solutions Navigator */}
          <div className="pt-1 pb-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <span className="h-1 w-1 bg-amber-500" />
              <span>Tailored For Your Practice:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Link
                to="/solutions/company-secretaries"
                className="inline-flex items-center gap-1.5 rounded-xs border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Company Secretaries (PCS)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/chartered-accountants"
                className="inline-flex items-center gap-1.5 rounded-xs border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Chartered Accountants (CA)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/corporate-legal-teams"
                className="inline-flex items-center gap-1.5 rounded-xs border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Corporate Legal Teams</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/compare/docketra-vs-excel-whatsapp"
                className="inline-flex items-center gap-1.5 rounded-xs border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>vs. Excel & WhatsApp</span>
                <span className="text-slate-400">→</span>
              </Link>
            </div>
          </div>

          {/* Simple CTA Action Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 rounded-xs bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800"
            >
              <span>Create workspace</span>
              <span>→</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 rounded-xs border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Take a product tour</span>
            </button>
          </div>

          {/* Trust points */}
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-slate-500 pt-0.5">
            <span>No credit card required</span>
            <span className="text-slate-300">•</span>
            <span>2-minute setup</span>
            <span className="text-slate-300">•</span>
            <span>Files save to your Google Drive</span>
          </p>

          {/* 6 Capabilities Grid */}
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
            {HERO_BADGES.map((badge) => (
              <div
                key={badge.label}
                className="group flex items-start gap-2 rounded-xs border border-slate-200/80 bg-white p-2 hover:border-slate-300 transition-colors"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-slate-100 text-slate-700 mt-0.5">
                  {badge.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-900 leading-tight">
                    {badge.label}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 leading-tight mt-0.5">
                    {badge.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Hero: Compact Interactive Canvas */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="relative lg:pl-2"
        >
          <InteractiveProductCanvas />
        </motion.div>
      </div>
    </Container>
  </section>
);

const SubHeroMetricsStrip = () => (
  <section className="border-b border-slate-200/80 bg-white py-6">
    <Container size="7xl">
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            stat: 'Google Drive',
            label: 'Your Own Storage',
            desc: 'Files stay in your firm’s folders',
          },
          {
            stat: 'Due Dates',
            label: 'Never Miss a Filing',
            desc: 'MCA, GST, and Tax reminders',
          },
          {
            stat: 'Partner QC',
            label: 'Check Before Filing',
            desc: 'Review work to prevent mistakes',
          },
          {
            stat: 'Team Worklists',
            label: 'Clear Task Ownership',
            desc: 'See who is doing what today',
          },
        ].map((item, idx) => (
          <div key={idx} className="border-l border-slate-200 pl-4 py-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="text-base font-bold text-slate-950 mt-1">{item.stat}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-16 bg-slate-50/50 py-16 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">Docketra Pillars</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          One platform. Every professional workflow.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Built specifically for Indian CS, CA, and legal firms. Operational tools to manage client work without chaos.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: 'Client memory',
            body: 'Keep company details, CIN, PAN, director contacts, and past filings together so staff don’t have to ask the client twice.',
            solves: 'Solves scattered context',
          },
          {
            title: 'Dockets',
            body: 'Every matter gets a clear folder with deadlines, assigned staff, documents, and status from start to finish.',
            solves: 'Solves ownership gaps',
          },
          {
            title: 'Worklist & Workbaskets',
            body: 'Team members see their exact daily tasks on their Worklist. Managers can route and assign work or staff can pull from shared Workbaskets.',
            solves: 'Solves daily execution drift',
          },
          {
            title: 'QC Workbaskets & review',
            body: 'Partners can review draft filings, check challans in QC Workbaskets, and flag corrections before submitting to the government.',
            solves: 'Solves review uncertainty',
          },
          {
            title: 'Reports and audit trails',
            body: 'See how many filings are due this week, what is stuck, and full history of who did what and when.',
            solves: 'Solves partner blind spots',
          },
          {
            title: 'Google Drive Storage',
            body: 'Documents save directly into your own Google Drive. You maintain 100% control of your client records.',
            solves: 'Zero vendor lock-in',
          },
        ].map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-sm border border-slate-200/80 bg-white p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-950">{pillar.title}</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{pillar.body}</p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span className="text-amber-600">✓</span>
              <span>{pillar.solves}</span>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="scroll-mt-16 bg-white py-16 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">The Problem</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Why Excel and generic apps fail professional firms
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Generic task trackers and WhatsApp don't know what MCA forms or CIN numbers are. Here is how Docketra fixes that:
        </p>
      </motion.div>

      {/* Comparison Table */}
      <div className="mt-8">
        <ComplianceVsGenericComparison />
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-slate-50/50 py-16 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">How It Works</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          How work moves in Docketra
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          A clear 4-step flow from the moment client work comes in to the final filing.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: '01',
            title: 'Create Matter',
            desc: 'A client calls or emails with a task. You create a docket linked to that client in 30 seconds.',
          },
          {
            step: '02',
            title: 'Assign to Team',
            desc: 'Assign it to an associate with a due date. They see it immediately on their daily worklist.',
          },
          {
            step: '03',
            title: 'Save to Google Drive',
            desc: 'Staff prepare the filing, attach documents, and save directly into your firm’s Google Drive.',
          },
          {
            step: '04',
            title: 'Partner Review & File',
            desc: 'Partner reviews the final forms, gives approval, and marks the filing complete.',
          },
        ].map((item) => (
          <div key={item.step} className="rounded-sm border border-slate-200/80 bg-white p-5 hover:border-slate-300 transition-colors">
            <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
              {item.step}
            </span>
            <h3 className="mt-3 text-sm font-bold text-slate-950">{item.title}</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-[#0B0F19] py-16 text-white border-b border-slate-800">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">Your Data, Your Control</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Your client files stay in your own Google Drive
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          We believe professional firms should always own their data. Docketra connects to your Google Drive so confidential client documents never leave your firm.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-slate-800 bg-slate-950 p-5 space-y-2 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">100% Data Ownership</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All client working papers, balance sheets, and notices stay inside your Google Drive. We never lock you in.
          </p>
        </div>
        <div className="rounded-sm border border-slate-800 bg-slate-950 p-5 space-y-2 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">Staff Permissions</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Admins, Managers, and Employees have different access levels so staff only see what they need to work on.
          </p>
        </div>
        <div className="rounded-sm border border-slate-800 bg-slate-950 p-5 space-y-2 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">Activity History</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Docketra keeps a record of every status change and review sign-off so you always know who approved what.
          </p>
        </div>
      </div>
    </Container>
  </section>
);

const PilotReadinessSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-white py-16 border-b border-slate-200/80">
    <Container size="7xl">
      <div className="rounded-sm border border-slate-200/80 bg-slate-50/80 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">Try It With Your Team</span>
          <h2 className="text-2xl font-bold text-slate-950 tracking-tight">
            Start using Docketra for your firm in 5 minutes
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Create your firm account, invite your team members, and manage your first 5 clients. No credit card required.
          </p>
        </div>

        <Link
          to="/signup"
          className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 rounded-xs bg-slate-950 px-6 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800 shrink-0"
        >
          <span>Create workspace</span>
          <span>→</span>
        </Link>
      </div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-slate-50/50 py-16 text-center">
    <Container size="7xl">
      <motion.div className="max-w-2xl mx-auto space-y-3" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
          Give every docket a memory.
        </h2>
        <p className="text-sm font-semibold text-slate-900">
          For partners, managers, and execution teams.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Start with one workspace, your team, and an easier way to keep track of daily client work.
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            to="/signup"
            className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 rounded-xs bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800"
          >
            <span>Create workspace</span>
            <span>→</span>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 rounded-xs border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <span>Find workspace</span>
          </Link>
        </div>

        <p className="font-mono text-[11px] text-slate-400 pt-2">
          No credit card required • Cancel anytime • Free pilot setup
        </p>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-10 text-slate-400 border-t border-slate-800 text-xs">
    <Container size="7xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2 text-white font-semibold">
          <span className="h-1.5 w-1.5 rounded-xs bg-amber-500" />
          <span>Docketra</span>
          <span className="text-slate-500 text-[11px] font-mono">• The Company Brain for Indian Firms</span>
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
        title="Docketra — The Company Brain for Indian Professional Firms"
        description="Streamline client dockets, MCA deadlines, and team tasks in one sovereign workspace. Purpose-built for Indian CS, CA, and legal firms. Start your free pilot."
      />
      <PublicMarketingHeader />
      <HeroSection onOpenTour={() => setIsTourOpen(true)} />
      <SubHeroMetricsStrip />
      <ProductPillarsSection />
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
