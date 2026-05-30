import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import Container from '../../components/layout/Container';

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: 'easeOut' },
  viewport: { once: true, amount: 0.18 },
};

const HERO_METRICS = [
  { label: 'Open dockets', value: '124', note: '42 due this week' },
  { label: 'QC queue', value: '09', note: '3 need partner review' },
  { label: 'Client memory', value: '2.4k', note: 'facts, docs, notes' },
];

const PAIN_POINTS = [
  { emoji: '📲', title: 'Work is scattered', body: 'WhatsApp, Excel, email, and folders all carry different versions of the truth.' },
  { emoji: '🧠', title: 'Context sits in heads', body: 'Client facts, filing history, and exceptions disappear when the usual person is unavailable.' },
  { emoji: '⏳', title: 'Deadlines surprise teams', body: 'Partners only see risk after work is already late, stuck, or waiting for QC.' },
  { emoji: '🔁', title: 'Repeat work restarts', body: 'Teams rebuild context for recurring filings instead of reusing firm memory.' },
  { emoji: '🎯', title: 'Ownership gets fuzzy', body: 'Managers chase updates because accountability is not visible at docket level.' },
  { emoji: '✅', title: 'QC is informal', body: 'Review handoffs, corrections, and final filing confidence need a clearer trail.' },
];

const PILLARS = [
  {
    emoji: '🧠',
    title: 'Client Memory',
    body: 'Client profile, CFS, documents, prior dockets, and context notes stay connected to the work.',
  },
  {
    emoji: '⚡',
    title: 'Work Execution',
    body: 'Worklist, Workbaskets, QC Workbaskets, and docket lifecycle states keep daily execution moving.',
  },
  {
    emoji: '🎛️',
    title: 'Firm Control',
    body: 'Role hierarchy, team access, client access, and reports give partners a command layer.',
  },
  {
    emoji: '🔍',
    title: 'Trust & Traceability',
    body: 'Audit history, role-based access, storage visibility, and action records make work easier to verify.',
  },
];

const WORKFLOW_STEPS = [
  { emoji: '🏢', title: 'Create workspace', body: 'Set up the firm, roles, teams, and workspace access.' },
  { emoji: '👥', title: 'Add clients and team', body: 'Bring client memory and employee ownership into one operating layer.' },
  { emoji: '🧺', title: 'Configure workbaskets', body: 'Map categories, queues, and QC paths to how the firm actually works.' },
  { emoji: '📝', title: 'Create dockets', body: 'Turn recurring work, filings, and client requests into trackable execution.' },
  { emoji: '✅', title: 'Review and report', body: 'Managers see progress, bottlenecks, QC status, and history without chasing.' },
];

const OWNER_SIGNALS = [
  { value: 'Role clarity', label: 'See who can access each client, docket, and workspace area.' },
  { value: 'Deadline visibility', label: 'Spot risk before late work becomes client-facing pain.' },
  { value: 'Firm memory', label: 'Keep client context searchable as the team grows.' },
  { value: 'QC confidence', label: 'Move review from informal follow-up to traceable handoff.' },
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
  { emoji: '🔐', title: 'Access boundaries', body: 'Role-based access with clear team and client boundaries.' },
  { emoji: '🧾', title: 'Action history', body: 'Client access control and action-level audit history.' },
  { emoji: '☁️', title: 'Storage clarity', body: 'BYOS/storage transparency direction for firm-level visibility.' },
  { emoji: '🙈', title: 'Secret-safe surfaces', body: 'No secrets exposed in storage visibility surfaces.' },
];

const ProductMockup = () => (
  <div className="relative">
    <div className="absolute -right-4 -top-5 hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-xl shadow-amber-200/30 sm:block">
      ✨ Partner view ready
    </div>

    <div className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_30px_100px_-36px_rgba(15,23,42,0.5)]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-950 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
          app.docketra.com/workspace
        </span>
      </div>

      <div className="grid min-h-[430px] lg:grid-cols-[180px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-50 p-4 lg:block">
          <div className="mb-5 rounded-2xl bg-slate-900 p-3 text-white">
            <p className="text-xs text-slate-300">Firm HQ</p>
            <p className="mt-1 text-sm font-bold">Mehta & Co.</p>
          </div>
          <div className="space-y-2 text-xs font-medium">
            {['✅ Worklist', '🧺 Workbaskets', '📝 Dockets', '🧠 Clients', '📊 Reports', '🔐 Access'].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 ${
                  index === 0
                    ? 'bg-amber-100 text-amber-900'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Today&apos;s command center</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Work that needs owner attention</h3>
            </div>
            <span className="inline-flex w-max rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              🟢 Healthy workspace
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {HERO_METRICS.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">Priority dockets</p>
                <span className="text-xs font-semibold text-amber-700">⚡ Live queue</span>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                {[
                  ['Annual filing', 'GreenLeaf Foods', 'Due tomorrow', 'Priya'],
                  ['GST return', 'Apex Retail', 'Waiting client docs', 'Arjun'],
                  ['Board resolution', 'Nova Labs', 'QC review', 'Meera'],
                ].map(([work, client, status, owner]) => (
                  <div key={`${work}-${client}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{work}</p>
                      <p className="text-xs text-slate-500">{client} · Owner: {owner}</p>
                    </div>
                    <span className="self-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
              <p className="text-sm font-bold">🧠 Client memory card</p>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <p className="rounded-xl bg-white/10 p-3">Last filing exception: Director DSC expired in April.</p>
                <p className="rounded-xl bg-white/10 p-3">Preferred reviewer: Meera before partner sign-off.</p>
                <p className="rounded-xl bg-white/10 p-3">Pending: bank statement and board minutes.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
);

const SectionEyebrow = ({ children }) => (
  <p className="text-sm font-bold uppercase text-amber-700">{children}</p>
);

const HeroSection = ({ onExplore }) => (
  <section className="relative overflow-hidden bg-[#fff8eb] py-16 md:py-20 lg:py-24">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(251,191,36,0.24),transparent_32%),radial-gradient(circle_at_86%_4%,rgba(20,184,166,0.16),transparent_26%),linear-gradient(135deg,#fff8eb_0%,#ffffff_48%,#f1f5f9_100%)]" />
    <Container className="relative">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div {...REVEAL}>
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-white/80 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">
            ✨ Built for Indian professional firms
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-slate-950 sm:text-5xl lg:text-6xl">
            The Company Brain for Indian professional firms.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            Docketra brings client memory, dockets, worklists, workbaskets, QC, reports, and audit trails into one secure workspace built for CS, CA, law, and compliance teams.
          </p>
          <p className="mt-3 max-w-xl text-base font-medium text-slate-600">
            Give owners one calm command center for deadlines, accountability, and the firm knowledge that compounds over time.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800">
              Create workspace
            </Link>
            <Link to="/find-workspace" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-6 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-white">
              Find workspace
            </Link>
            <button type="button" onClick={onExplore} className="inline-flex h-12 items-center justify-center rounded-xl border border-transparent px-6 text-sm font-bold text-slate-700 transition-colors hover:bg-white/70">
              See how it works
            </button>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            {['🔐 Role-safe access', '📊 Owner reports', '✅ QC visibility'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 26 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          viewport={{ once: true }}
        >
          <ProductMockup />
        </motion.div>
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="scroll-mt-24 bg-slate-950 py-16 text-white md:py-20">
    <Container>
      <motion.div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]" {...REVEAL}>
        <div>
          <SectionEyebrow>😵 Why firms feel busy but blind</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Execution breaks when work and memory live in different places.</h2>
          <p className="mt-4 text-slate-300">
            Docketra is designed for firm owners who need visibility without turning every update into a follow-up call.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PAIN_POINTS.map((point) => (
            <li key={point.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="text-2xl" aria-hidden="true">{point.emoji}</div>
              <h3 className="mt-3 font-bold text-white">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{point.body}</p>
            </li>
          ))}
        </ul>
      </motion.div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-24 bg-white py-16 md:py-20">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <SectionEyebrow>🏗️ Product spine</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
          Four pillars: Company Brain + Work Execution OS.
        </h2>
      </motion.div>

      <div className="mt-9 grid gap-4 md:grid-cols-2">
        {PILLARS.map((pillar) => (
          <motion.div key={pillar.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm" {...REVEAL}>
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm" aria-hidden="true">
                {pillar.emoji}
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-slate-950">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-24 bg-[#f8fafc] py-16 md:py-20">
    <Container>
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <motion.div {...REVEAL}>
          <SectionEyebrow>🧭 Firm workflow</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">How it works.</h2>
          <p className="mt-4 text-slate-600">
            Start with workspace setup, then let every docket add structure to the firm&apos;s operating memory.
          </p>
        </motion.div>
        <div className="grid gap-3">
          {WORKFLOW_STEPS.map((step, index) => (
            <motion.div key={step.title} className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" {...REVEAL}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-lg font-bold text-amber-900">
                {step.emoji}
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Step {index + 1}</p>
                <h3 className="mt-1 font-extrabold text-slate-950">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Container>
  </section>
);

const WhyNotTaskManagerSection = () => (
  <section id="pilot-readiness" className="scroll-mt-24 bg-white py-16 md:py-20">
    <Container>
      <motion.div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 md:p-8" {...REVEAL}>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionEyebrow>🚫 Not another task manager</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Built for owners who need control, not more todos.</h2>
            <p className="mt-4 text-slate-300">
              Generic task managers track tasks. Docketra understands clients, dockets, workbaskets, QC workflows, access roles, and audit trails.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {OWNER_SIGNALS.map((signal) => (
              <div key={signal.value} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <h3 className="font-extrabold text-white">{signal.value}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{signal.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const UseCasesSection = () => (
  <section className="bg-[#fff8eb] py-16 md:py-20">
    <Container>
      <motion.div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" {...REVEAL}>
        <div>
          <SectionEyebrow>📌 Where firms use it</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Use cases.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-600">
          Start with one repeated workflow, then expand Docketra across the firm as memory and reporting compound.
        </p>
      </motion.div>
      <div className="mt-9 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((copy) => (
          <div key={copy} className="rounded-2xl border border-amber-200/70 bg-white/80 p-4 text-sm font-semibold text-slate-800 shadow-sm">
            ✨ {copy}
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-24 bg-white py-16 md:py-20">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <SectionEyebrow>🔒 Trust and control</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">A firmer operating layer for sensitive work.</h2>
      </motion.div>
      <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TRUST_POINTS.map((point) => (
          <div key={point.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-2xl" aria-hidden="true">{point.emoji}</div>
            <h3 className="mt-3 font-extrabold text-slate-950">{point.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{point.body}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const FutureAiSection = () => (
  <section className="bg-slate-950 py-16 text-white md:py-20">
    <Container>
      <motion.div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" {...REVEAL}>
        <div>
          <SectionEyebrow>🤖 AI-ready, control-first</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Built for AI-assisted firm operations without losing control.</h2>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6">
          <p className="text-slate-200">
            Docketra is designed to organize the firm&apos;s work, client facts, history, and documents first. AI assistance can then help summarize client history, suggest next steps, and surface risk based on structured firm context.
          </p>
          <p className="mt-4 text-sm font-semibold text-amber-200">AI assistance is roadmap-oriented and assistive; execution remains Worklist-first.</p>
        </div>
      </motion.div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_45%,#e0f2fe_100%)] py-16 md:py-20">
    <Container>
      <motion.div className="mx-auto max-w-4xl text-center" {...REVEAL}>
        <p className="text-sm font-bold uppercase text-amber-700">🚀 Ready when the firm is</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-5xl">Start building your firm&apos;s Company Brain.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          Begin with client memory, dockets, and owner visibility. Keep the workflow playful enough for teams to enjoy, serious enough for partners to trust.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-8 text-sm font-bold text-white shadow-lg shadow-slate-900/20">
            Create workspace
          </Link>
          <Link to="/find-workspace" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-8 text-sm font-bold text-slate-800 shadow-sm">
            Find workspace
          </Link>
        </div>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-10 text-slate-100">
    <Container>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/" className="text-lg font-extrabold text-white">✨ Docketra</Link>
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
