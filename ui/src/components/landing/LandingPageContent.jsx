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

const HeroSection = ({ onOpenTour }) => (
  <section className="relative overflow-hidden bg-slate-50/40 pt-20 pb-12 sm:pt-24 md:pt-24 md:pb-16 border-b border-slate-200">
    <Container size="7xl" className="relative">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <motion.div {...REVEAL} className="space-y-4">
          {/* Eyebrow Kicker */}
          <div className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Built for Indian professional firms
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
            The Company Brain for Indian professional firms.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base font-normal leading-relaxed text-slate-600 max-w-xl">
            Connected workspace for client memory, statutory dockets, team worklists, and partner QC.
          </p>

          <p className="text-xs font-medium text-slate-900">
            For CS, CA, law, and compliance teams that cannot afford missing context.
          </p>

          {/* Practice Solutions Navigation */}
          <div className="pt-1.5 pb-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tailored For Your Practice:
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                to="/solutions/company-secretaries"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Company Secretaries (PCS)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/chartered-accountants"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Chartered Accountants (CA)</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/solutions/corporate-legal-teams"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>Corporate Legal Teams</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                to="/compare/docketra-vs-excel-whatsapp"
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-950 transition-colors"
              >
                <span>vs. Excel & WhatsApp</span>
                <span className="text-slate-400">→</span>
              </Link>
            </div>
          </div>

          {/* Primary Action Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800"
            >
              <span>Create workspace</span>
              <span>→</span>
            </Link>

            <Link
              to="/find-workspace"
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <span>Find workspace</span>
            </Link>

            <button
              type="button"
              onClick={onOpenTour}
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            >
              <span>Product tour</span>
            </button>
          </div>

          {/* Operational Guarantees */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 pt-1">
            <span>No credit card required</span>
            <span>Files save to your Google Drive</span>
            <span>Cancel anytime</span>
          </div>
        </motion.div>

        {/* Right Hero: Compact 2026 Workspace Canvas */}
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
  <section className="border-b border-slate-200 bg-white py-6">
    <Container size="7xl">
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            stat: 'Google Drive',
            label: 'Sovereign Storage',
            desc: 'Files save straight to your firm folder',
          },
          {
            stat: 'Due Dates',
            label: 'Statutory Radar',
            desc: 'MCA, GST, and Tax cutoffs tracked',
          },
          {
            stat: 'Partner QC',
            label: 'Sign-off Gates',
            desc: 'Check work before government submission',
          },
          {
            stat: 'Team Worklists',
            label: 'Clear Task Ownership',
            desc: 'Direct allocation across staff',
          },
        ].map((item, idx) => (
          <div key={idx} className="border-l border-slate-200 pl-4 py-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="text-base font-bold text-slate-950 mt-0.5">{item.stat}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-16 bg-slate-50/40 py-16 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Architecture</div>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          One platform. Every professional workflow.
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Operational structure built specifically for Indian CS, CA, and legal firms.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: 'Client memory',
            body: 'Centralized company master records, CIN, PAN, and director contacts accessible firm-wide.',
            tag: 'Zero Context Loss',
          },
          {
            title: 'Dockets',
            body: 'Structured matter containers tracking deadlines, documents, and ownership from start to finish.',
            tag: 'Ownership Visibility',
          },
          {
            title: 'Worklist & Workbaskets',
            body: 'Individual staff task queues paired with shared firm workbaskets for balanced intake.',
            tag: 'Execution Flow',
          },
          {
            title: 'QC Workbaskets & review',
            body: 'Two-tier verification where partners check draft forms and challans before final filing.',
            tag: 'Partner Sign-off',
          },
          {
            title: 'Reports and audit trails',
            body: 'Real-time visibility into pending filings, bottlenecks, and immutable timestamped actions.',
            tag: 'Audit Readiness',
          },
          {
            title: 'Google Drive Storage',
            body: 'Documents save directly into your firm’s private Google Drive with 100% data custody.',
            tag: 'Sovereign Control',
          },
        ].map((pillar) => (
          <div
            key={pillar.title}
            className="border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-400 transition-colors"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-950">{pillar.title}</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{pillar.body}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span className="text-amber-600">✓</span>
              <span>{pillar.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="scroll-mt-16 bg-white py-16 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Comparison</div>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Why Excel and generic apps fail professional firms
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Spreadsheets lack statutory logic. Generic issue trackers lack firm compliance workflows.
        </p>
      </motion.div>

      <div className="mt-8">
        <ComplianceVsGenericComparison />
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-slate-50/40 py-16 border-b border-slate-200">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Execution Lifecycle</div>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          How work moves in Docketra
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Four disciplined stages from client mandate to completed statutory filing.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: '01',
            title: 'Intake Matter',
            desc: 'Create a docket linked to client memory in 30 seconds.',
          },
          {
            step: '02',
            title: 'Assign to Worklist',
            desc: 'Assign to an associate with statutory deadline dates.',
          },
          {
            step: '03',
            title: 'Drive Working Papers',
            desc: 'Working documents save directly into your Google Drive.',
          },
          {
            step: '04',
            title: 'Partner QC & Filing',
            desc: 'Partner verifies challans, approves, and marks complete.',
          },
        ].map((item) => (
          <div key={item.step} className="border border-slate-200 bg-white p-5 hover:border-slate-400 transition-colors">
            <span className="font-mono text-xs font-bold text-amber-600 tracking-wider">
              {item.step}
            </span>
            <h3 className="mt-2 text-sm font-bold text-slate-950">{item.title}</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-[#080C14] py-16 text-white border-b border-slate-800">
    <Container size="7xl">
      <motion.div className="max-w-2xl" {...REVEAL}>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">Data Sovereignty</div>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Your client files stay in your own Google Drive
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Docketra connects directly to your Google Drive. Confidential client documents never leave your firm.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-1.5 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">100% Data Ownership</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Client working papers and financial statements stay in your Google Drive with zero proprietary lock-in.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-1.5 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">Firm Role Boundaries</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Explicit access boundaries ensure associates and managers only access authorized client matters.
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 space-y-1.5 hover:border-slate-700 transition-colors">
          <h3 className="text-sm font-bold text-white">Immutable Audit Trail</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Complete record of every status transition, review sign-off, and filing timestamp.
          </p>
        </div>
      </div>
    </Container>
  </section>
);

const PilotReadinessSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-white py-16 border-b border-slate-200">
    <Container size="7xl">
      <div className="border border-slate-200 bg-slate-50/60 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-1 max-w-xl">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Packaging & Pilot
            </div>
            <h2 className="text-2xl font-bold text-slate-950 tracking-tight">
              Start using Docketra for your firm in 5 minutes
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create your firm workspace, invite your team, and manage your first 5 clients for ₹0. Pioneer 30 launch pass available for scaling practices.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <Link
              to="/signup"
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-6 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800 shrink-0"
            >
              <span>Create workspace</span>
              <span>→</span>
            </Link>
            <Link
              to="/pricing"
              className="inline-flex w-full sm:w-auto h-10 items-center justify-center border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
            >
              <span>View all plans & bonuses</span>
            </Link>
          </div>
        </div>

        {/* 3 Value Pillars */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-amber-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-900">Free Sandbox (₹0 forever):</span>
              <p className="text-slate-600 mt-0.5">Up to 2 seats, 5 clients, and full sovereign Google Drive integration.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-amber-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-900">Pioneer 30 Pass (₹12,990/yr):</span>
              <p className="text-slate-600 mt-0.5">Grandfathered rate locked for life for first 30 firms. Zero setup fees.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-amber-600 font-bold">✓</span>
            <div>
              <span className="font-bold text-slate-900">30-Day Sovereign Guarantee:</span>
              <p className="text-slate-600 mt-0.5">100% money-back guarantee. All client files remain permanently in your Drive.</p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-slate-50/40 py-16 text-center">
    <Container size="7xl">
      <motion.div className="max-w-2xl mx-auto space-y-3" {...REVEAL}>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
          Give every docket a memory.
        </h2>
        <p className="text-sm font-semibold text-slate-900">
          For partners, managers, and execution teams.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Start with one workspace, invite your associates, and eliminate scattered client operations.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-xs font-semibold text-amber-400 transition-colors hover:bg-slate-800"
          >
            <span>Create workspace</span>
            <span>→</span>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex w-full sm:w-auto h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <span>Find workspace</span>
          </Link>
        </div>

        <div className="font-mono text-[11px] text-slate-400 pt-2 flex items-center justify-center gap-4">
          <span>No credit card required</span>
          <span>Cancel anytime</span>
          <span>Free pilot setup</span>
        </div>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-10 text-slate-400 border-t border-slate-800 text-xs">
    <Container size="7xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5 text-white font-semibold">
          <span className="h-1.5 w-1.5 bg-amber-500" />
          <span>Docketra</span>
          <span className="text-slate-500 text-[11px] font-mono">| The Company Brain for Indian Firms</span>
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
        title="Docketra: The Company Brain for Indian Professional Firms"
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
