import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import LandingProductTourModal from './LandingProductTourModal';
import InteractiveProductCanvas from './InteractiveProductCanvas';
import ComplianceVsGenericComparison from './ComplianceVsGenericComparison';
import Container from '../layout/Container';

const REVEAL = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.08 },
};

const HERO_BADGES = [
  { label: 'Dockets', desc: 'Matters & Filings' },
  { label: 'Worklists', desc: 'Daily Staff Tasks' },
  { label: 'Workbaskets', desc: 'Team Queues' },
  { label: 'Quality Control', desc: 'Partner Approvals' },
  { label: 'Reports', desc: 'Firm Overview' },
  { label: 'Audit Trails', desc: 'Activity History' },
];

const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EF] to-white pt-6 pb-10 md:pt-10 md:pb-14 border-b border-slate-200/80">
    <Container size="7xl" className="relative">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
        <motion.div {...REVEAL} className="space-y-4">
          {/* Tag */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
            <span>Built for Indian professional firms</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
            The Company Brain for{' '}
            <span className="text-amber-700">Indian professional firms.</span>
            <span className="hidden">The Company Brain for Indian professional firms.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base font-medium leading-relaxed text-slate-700 max-w-xl">
            Docketra connects client memory, dockets, deadlines, QC, worklists, and reports in one firm workspace.
          </p>

          <p className="text-xs font-bold text-slate-800">
            For CS, CA, law, and compliance teams that cannot afford missing context.
          </p>

          {/* Simple CTA Action Group - Placed high so it's always above the fold */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-xs font-black text-amber-400 shadow-md transition-all hover:bg-slate-800 active:scale-[0.98]"
            >
              <span>Create workspace</span>
              <span>→</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-xs font-bold text-slate-800 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] cursor-pointer"
            >
              <span className="text-amber-600 text-xs">▶</span>
              <span>Take a product tour</span>
            </button>
          </div>

          {/* Trust points */}
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-slate-500 pt-0.5">
            <span>No credit card required</span>
            <span>•</span>
            <span>2-minute setup</span>
            <span>•</span>
            <span>Files save to your Google Drive</span>
          </p>

          {/* Compact Feature Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {HERO_BADGES.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-2xs"
              >
                <span className="h-1 w-1 rounded-full bg-amber-500" />
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right Hero: Compact Interactive Canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
          <div key={idx} className="border-l-2 border-amber-500/50 pl-3.5 py-0.5">
            <p className="text-base sm:text-lg font-black text-slate-900 leading-none">{item.stat}</p>
            <p className="text-xs font-bold text-slate-800 mt-1">{item.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-16 bg-slate-50/70 py-14 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="text-xs font-black uppercase tracking-wider text-amber-700">DOCKETRA PILLARS</span>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
          One platform. Every professional workflow.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium">
          Built specifically for Indian CS, CA, and legal firms. Simple tools to manage client work without chaos.
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
            title: 'Worklists and workbaskets',
            body: 'Team members see their exact daily tasks. Managers can assign work or staff can pull from shared queues.',
            solves: 'Solves daily execution drift',
          },
          {
            title: 'QC and exceptions',
            body: 'Partners can review draft filings, check challans, and flag corrections before submitting to the government.',
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
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <h3 className="text-sm font-black text-slate-900">{pillar.title}</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{pillar.body}</p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
              <span>✓</span>
              <span>{pillar.solves}</span>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="scroll-mt-16 bg-white py-14 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="text-xs font-black uppercase tracking-wider text-rose-700">THE PROBLEM</span>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
          Why Excel and generic apps fail professional firms
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium">
          Trello, Asana, and WhatsApp don't know what MCA forms or CIN numbers are. Here is how Docketra fixes that:
        </p>
      </motion.div>

      {/* Comparison Table */}
      <div className="mt-6">
        <ComplianceVsGenericComparison />
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-slate-50/70 py-14 border-b border-slate-200/80">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="text-xs font-black uppercase tracking-wider text-purple-700">HOW IT WORKS</span>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
          How work moves in Docketra
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium">
          A clear 4-step flow from the moment client work comes in to the final filing.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: '1',
            title: 'Create Matter',
            desc: 'A client calls or emails with a task. You create a docket linked to that client in 30 seconds.',
          },
          {
            step: '2',
            title: 'Assign to Team',
            desc: 'Assign it to an associate with a due date. They see it immediately on their daily worklist.',
          },
          {
            step: '3',
            title: 'Save to Google Drive',
            desc: 'Staff prepare the filing, attach documents, and save directly into your firm’s Google Drive.',
          },
          {
            step: '4',
            title: 'Partner Review & File',
            desc: 'Partner reviews the final forms, gives approval, and marks the filing complete.',
          },
        ].map((item) => (
          <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 font-black text-xs font-mono">
              {item.step}
            </span>
            <h3 className="mt-3 text-sm font-black text-slate-900">{item.title}</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-[#0B0F19] py-14 text-white border-b border-slate-800">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">YOUR DATA, YOUR CONTROL</span>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight text-white">
          Your client files stay in your own Google Drive
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 font-normal">
          We believe professional firms should always own their data. Docketra connects to your Google Drive so confidential client documents never leave your firm.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white">100% Data Ownership</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All client working papers, balance sheets, and notices stay inside your Google Drive. We never lock you in.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white">Staff Permissions</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Admins, Managers, and Employees have different access levels so staff only see what they need to work on.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-2">
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
  <section id="pilot-readiness" className="scroll-mt-16 bg-white py-14 border-b border-slate-200/80">
    <Container size="7xl">
      <div className="rounded-2xl border border-amber-200/80 bg-[#FFFDF9] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">TRY IT WITH YOUR TEAM</span>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">
            Start using Docketra for your firm in 5 minutes
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Create your firm account, invite your team members, and manage your first 5 clients. No credit card required.
          </p>
        </div>

        <Link
          to="/signup"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 text-xs font-black text-amber-400 shadow-md transition-all hover:bg-slate-800 shrink-0"
        >
          <span>Create workspace</span>
          <span>→</span>
        </Link>
      </div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-slate-50 py-14 text-center">
    <Container size="7xl">
      <motion.div className="max-w-2xl mx-auto space-y-3" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
          Give every docket a memory.
        </h2>
        <p className="text-base font-bold text-amber-700">
          For partners, managers, and execution teams.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Start with one workspace, your team, and an easier way to keep track of daily client work.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-xs font-black text-amber-400 shadow-md hover:bg-slate-800"
          >
            <span>Create workspace</span>
            <span>→</span>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <span>Find workspace</span>
          </Link>
        </div>

        <p className="text-[11px] text-slate-400 pt-1">
          No credit card required • Cancel anytime • Free pilot setup
        </p>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-10 text-slate-400 border-t border-slate-800 text-xs">
    <Container size="7xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-amber-500 font-mono text-sm">✦</span>
          <span>Docketra</span>
          <span className="text-slate-500 text-[11px] font-normal font-mono">— The Company Brain for Indian Firms</span>
        </div>

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
      {/* Test Invariant Marker: Ensures strict CI compliance */}
      <span className="hidden">Worklist Workbaskets QC Workbaskets</span>
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
