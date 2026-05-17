import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import Container from '../../components/layout/Container';

const REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
  viewport: { once: true, amount: 0.15 },
};

const PAIN_POINTS = [
  'Work is scattered across WhatsApp, Excel, email, and folders.',
  'Client facts live in people’s heads instead of systems.',
  'Deadline visibility is weak across teams and managers.',
  'Prior work history is hard to find during repeat filings.',
  'Owners and accountability are often unclear.',
  'Review and QC are handled informally.',
  'New employees cannot pick up past client context quickly.',
];

const PILLARS = [
  {
    title: 'Client Memory',
    body: 'Client profile, CFS, documents/attachments, prior dockets, and context notes in one place.',
  },
  {
    title: 'Work Execution',
    body: 'Worklist, Workbaskets, QC Workbaskets, and clear docket lifecycle states: pended, routed, resolved, filed.',
  },
  {
    title: 'Firm Control',
    body: 'Role hierarchy, team access, client access, work management, and reports for partner and manager oversight.',
  },
  {
    title: 'Trust & Traceability',
    body: 'Audit trail, role-based access, BYOS/cloud-storage direction, and history of every action.',
  },
];

const HOW_IT_WORKS = [
  'Create workspace',
  'Add clients and team',
  'Configure workbaskets and categories',
  'Create dockets',
  'Users pull work to Worklist',
  'Managers track progress in Reports',
  'Firm memory grows automatically from work history',
];

const USE_CASES = [
  'CS firm annual filings',
  'ROC and compliance tracking',
  'GST and TDS recurring work',
  'Legal matter task tracking',
  'Client document and CFS memory',
  'Internal firm work tracking',
];

const TRUST_POINTS = [
  'Role-based access with clear team and client boundaries.',
  'Client access control and action-level audit history.',
  'BYOS/storage transparency direction for firm-level visibility.',
  'No secrets exposed in storage visibility surfaces.',
];

const HeroPreview = () => (
  <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
    <div className="flex items-center gap-2 bg-slate-100/90 px-4 py-3 border-b border-slate-200">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="ml-3 flex-1 rounded-md bg-white border border-slate-200 text-xs text-slate-400 px-2.5 py-1">
        app.docketra.com/workspace
      </span>
    </div>

    <div className="grid md:grid-cols-12 min-h-[360px]">
      <aside className="md:col-span-4 border-r border-slate-200 bg-slate-50 p-4">
        <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-3">Work Execution OS</p>
        <div className="space-y-2 text-xs">
          {['Worklist', 'Dockets', 'Workbaskets', 'QC Workbaskets', 'Clients', 'Reports'].map((item) => (
            <div
              key={item}
              className={`rounded-md px-2.5 py-2 ${
                item === 'Worklist'
                  ? 'bg-amber-100 text-amber-800 font-semibold'
                  : 'text-slate-600 bg-white border border-slate-200'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </aside>

      <main className="md:col-span-8 p-5 bg-gradient-to-b from-white via-white to-slate-50">
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {['Open dockets: 24', 'Due this week: 7', 'QC queue: 3'].map((kpi) => (
            <div key={kpi} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 shadow-sm">
              {kpi}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700">Client Memory + Docket History</div>
          <div className="p-4 grid gap-3 text-xs">
            {[
              'Annual filing docket · GreenLeaf Foods · Owner: Priya',
              'GST return docket · Pending client docs · Assignee: Arjun',
              'QC handoff queue · 3 items awaiting reviewer assignment',
            ].map((row) => (
              <div key={row} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                {row}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const HeroSection = ({ onExplore }) => (
  <section className="w-full bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_34%),radial-gradient(circle_at_92%_18%,_rgba(14,165,233,0.1),_transparent_36%),linear-gradient(to_bottom_right,_#fffaf1,_#ffffff_40%,_#f8fafc)] py-20 md:py-28 lg:py-32">
    <Container>
      <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-10 items-center">
        <motion.div className="md:col-span-6" {...REVEAL}>
          <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 mb-5">
            Built for Indian professional firms
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-slate-900">
            The Company Brain for Indian professional firms.
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Docketra brings client memory, dockets, worklists, workbaskets, QC, reports, and audit trails into one secure workspace built for CS, CA, law, and compliance teams.
          </p>
          <p className="mt-3 text-base text-slate-600">
            Work Execution OS for day-to-day firm operations, with Company Brain context that compounds over time.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/signup" className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/15 hover:bg-slate-700 transition-colors">
              Create workspace
            </Link>
            <Link to="/find-workspace" className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
              Find workspace
            </Link>
            <button type="button" onClick={onExplore} className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
              See how it works
            </button>
          </div>
        </motion.div>

        <motion.div
          className="md:col-span-6"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          viewport={{ once: true }}
        >
          <HeroPreview />
        </motion.div>
      </div>
    </Container>
  </section>
);

const LegacyAnchor = ({ id }) => (
  <span id={id} className="relative -top-24 block" aria-hidden="true" />
);

const ProblemSection = () => (
  <section id="problem" className="w-full bg-slate-900 text-white py-20 md:py-28">
    <LegacyAnchor id="why" />
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Why execution breaks in many firms.</h2>
        <ul className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-slate-200">
          {PAIN_POINTS.map((point) => (
            <li key={point} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              {point}
            </li>
          ))}
        </ul>
      </motion.div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="pillars" className="w-full bg-slate-50 py-20 md:py-28">
    <LegacyAnchor id="product" />
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Four pillars: Company Brain + Work Execution OS.</h2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        {PILLARS.map((pillar) => (
          <motion.div key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" {...REVEAL}>
            <h3 className="text-xl font-bold text-slate-900">{pillar.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{pillar.body}</p>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="w-full bg-white py-20 md:py-28">
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">How it works.</h2>
        <ol className="mt-6 space-y-3 text-slate-700">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold inline-flex items-center justify-center mt-0.5">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </motion.div>
    </Container>
  </section>
);

const WhyNotTaskManagerSection = () => (
  <section id="difference" className="w-full bg-slate-50 py-20 md:py-24">
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Why not another task manager?</h2>
        <p className="mt-4 text-slate-600 max-w-3xl">
          Generic task managers track todos. Docketra understands clients, dockets, workbaskets, QC workflows, access roles, and audit trails — built for professional firm operations.
        </p>
      </motion.div>
    </Container>
  </section>
);

const UseCasesSection = () => (
  <section className="w-full bg-white py-20 md:py-24">
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Use cases.</h2>
      </motion.div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {USE_CASES.map((copy) => (
          <div key={copy} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {copy}
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="w-full bg-slate-900 text-white py-20 md:py-28">
    <LegacyAnchor id="pilot-readiness" />
    <Container>
      <motion.div {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Trust and control.</h2>
      </motion.div>
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        {TRUST_POINTS.map((point) => (
          <div key={point} className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-slate-200">
            {point}
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const FutureAiSection = () => (
  <section className="w-full bg-slate-50 py-20 md:py-24">
    <Container>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Built for AI-assisted firm operations — without losing control.</h2>
      <p className="mt-4 text-slate-600 max-w-3xl">
        Docketra is designed to organize the firm’s work, client facts, history, and documents first. AI assistance can then help summarize client history, suggest next steps, and surface risk — based on structured firm context.
      </p>
      <p className="mt-2 text-sm text-slate-500">AI assistance is roadmap-oriented and assistive; execution remains Worklist-first.</p>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 md:py-28">
    <Container>
      <motion.div className="text-center max-w-3xl mx-auto rounded-3xl border border-white/15 bg-white/5 px-6 py-12 md:px-10" {...REVEAL}>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Start building your firm’s Company Brain.</h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link to="/signup" className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-white text-slate-900 text-sm font-semibold">
            Create workspace
          </Link>
          <Link to="/find-workspace" className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-white/40 text-white text-sm font-medium">
            Find workspace
          </Link>
        </div>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 text-slate-100 py-12">
    <Container>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
        <div>
          <Link to="/" className="font-bold text-white text-lg">Docketra</Link>
          <p className="mt-1 text-sm text-slate-300">Company Brain + Work Execution OS for Indian professional firms</p>
        </div>

        <nav aria-label="Footer legal navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/terms" className="text-sm text-slate-300 hover:text-white">Terms</Link>
          <Link to="/privacy" className="text-sm text-slate-300 hover:text-white">Privacy</Link>
          <Link to="/security" className="text-sm text-slate-300 hover:text-white">Security</Link>
          <Link to="/acceptable-use" className="text-sm text-slate-300 hover:text-white">Acceptable Use</Link>
        </nav>
      </div>
    </Container>
  </footer>
);

export const LandingPageContent = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;

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
    <div className="w-full bg-white text-slate-900 antialiased">
      <PublicMarketingHeader />
      <HeroSection onExplore={() => handleSectionNavigation('workflow')} />
      <ProblemSection />
      <ProductPillarsSection />
      <HowItWorksSection />
      <WhyNotTaskManagerSection />
      <UseCasesSection />
      <TrustSection />
      <FutureAiSection />
      <FinalCtaSection />
      <MarketingFooter />
    </div>
  );
};
