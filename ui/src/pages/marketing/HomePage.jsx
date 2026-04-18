import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Container from '../../components/layout/Container';

const CONTACT_EMAIL = 'sarveshgupte@gmail.com';

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' },
  viewport: { once: true, amount: 0.2 },
};

const PROBLEMS = [
  {
    title: 'Work updates are spread everywhere',
    body: 'Client details, files, and follow-ups sit in chats, spreadsheets, and personal notes.',
  },
  {
    title: 'Important follow-ups get missed',
    body: 'When ownership is unclear, pending items stay pending and deadlines quietly slip.',
  },
  {
    title: 'Leaders cannot see what is delayed',
    body: 'Without one shared view, it is hard to spot risk early and support the right team members.',
  },
];

const FEATURE_HIGHLIGHTS = [
  {
    title: 'Client and lead tracking',
    body: 'Keep every client conversation, status update, and next step in one place.',
  },
  {
    title: 'Task and docket ownership',
    body: 'Assign work clearly, track progress daily, and know exactly who is responsible.',
  },
  {
    title: 'Document collection',
    body: 'Request and collect documents with clear checklists so teams can move faster.',
  },
  {
    title: 'Follow-up visibility',
    body: 'See pending items, upcoming deadlines, and delayed work before they become problems.',
  },
  {
    title: 'Firm-wide work view',
    body: 'Get a clean picture of open, blocked, and completed work across your firm.',
  },
  {
    title: 'Built for real operations',
    body: 'Set up your teams and workflows to match how your firm already works.',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Capture work in one place',
    body: 'Bring new client requests and internal work into a shared queue from day one.',
  },
  {
    title: 'Assign and execute with clarity',
    body: 'Set owners, track progress, and keep documents and updates connected to each job.',
  },
  {
    title: 'Review, follow up, and finish on time',
    body: 'Use clear status views to catch delays early and close work with confidence.',
  },
];

const STATS = [
  { label: 'Pending work caught early', value: 78, suffix: '%' },
  { label: 'Faster team handoffs', value: 42, suffix: '%' },
  { label: 'Fewer missed follow-ups', value: 63, suffix: '%' },
];

const USE_CASES = [
  'Chartered accountancy firms',
  'Company secretary firms',
  'Law and compliance firms',
  'Advisory and tax operations teams',
  'Multi-branch service firms',
  'Growing firms replacing spreadsheets and chat-based tracking',
];

const HeroSection = ({ onExplore }) => (
  <section className="w-full bg-gradient-to-b from-white via-slate-50 to-white py-16 md:py-24">
    <Container className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8 lg:gap-12 items-center">
      <motion.div className="md:col-span-7" {...SECTION_REVEAL}>
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">For modern professional firms</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
          Run your firm with clear ownership, cleaner follow-ups, and less chaos.
        </h1>
        <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">
          Docketra helps firm owners manage clients, work, documents, and team tasks in one place so nothing important gets missed.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-all"
          >
            Start free early access
          </Link>
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            See how it works
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500">No billing yet. Early access is currently free.</p>
      </motion.div>

      <motion.div
        className="md:col-span-5 rounded-2xl border border-gray-200 bg-white shadow-lg p-5"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        viewport={{ once: true }}
      >
        <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Live operations preview</p>
        <h3 className="mt-2 text-lg font-semibold text-gray-900">Today at your firm</h3>

        <div className="mt-5 space-y-3">
          {[
            { label: 'New client requests', value: '18', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Tasks in progress', value: '46', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Pending follow-ups', value: '7', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border p-4 ${item.tone} transition-all hover:-translate-y-0.5`}>
              <p className="text-xs font-medium uppercase tracking-wide">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Team ownership</p>
          <div className="mt-3 space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Accounts team: 14 open items</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" />Compliance team: 9 open items</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Awaiting client docs: 7 items</div>
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const ProblemSolutionSection = () => (
  <section className="w-full bg-gray-900 text-white py-16 md:py-20">
    <Container>
      <motion.div {...SECTION_REVEAL}>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Why firms switch</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">
          Stop managing work across scattered tools.
        </h2>
      </motion.div>

      <motion.div className="grid md:grid-cols-3 gap-6 mt-10" {...SECTION_REVEAL}>
        {PROBLEMS.map((card) => (
          <div key={card.title} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-3">{card.title}</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{card.body}</p>
          </div>
        ))}
      </motion.div>

      <motion.div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-900/10 p-6" {...SECTION_REVEAL}>
        <p className="text-sm text-emerald-200">
          With Docketra, your team manages clients, tasks, dockets, documents, and follow-ups in one clear workflow.
        </p>
      </motion.div>
    </Container>
  </section>
);

const FeatureHighlightsSection = () => (
  <section id="features" className="w-full bg-white py-16 md:py-20 border-y border-gray-100">
    <Container>
      <motion.div {...SECTION_REVEAL}>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Main features</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
          Everything your firm needs to stay on top of work.
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {FEATURE_HIGHLIGHTS.map((feature, index) => (
          <motion.div
            key={feature.title}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.06, 0.24) }}
            viewport={{ once: true }}
          >
            <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.body}</p>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="how-it-works" className="w-full bg-gray-50 py-16 md:py-20">
    <Container>
      <motion.div {...SECTION_REVEAL}>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How it works</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">
          Get started in 3 simple steps.
        </h2>
      </motion.div>
      <motion.div className="grid md:grid-cols-3 gap-5 mt-10" {...SECTION_REVEAL}>
        {HOW_IT_WORKS.map((step, idx) => (
          <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-gray-500">STEP {idx + 1}</p>
            <p className="mt-2 text-base font-semibold text-gray-900">{step.title}</p>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </motion.div>
    </Container>
  </section>
);

const VisualProofSection = () => (
  <section className="w-full bg-gray-900 text-white py-16 md:py-20">
    <Container>
      <motion.div {...SECTION_REVEAL}>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Visual proof</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
          See the difference between scattered and organized work.
        </h2>
      </motion.div>

      <motion.div className="grid gap-6 md:grid-cols-2 mt-10" {...SECTION_REVEAL}>
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
          <p className="text-sm font-semibold text-white">Before Docketra</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            <li>• Updates split across chat, calls, and spreadsheets</li>
            <li>• Follow-ups depend on memory and personal reminders</li>
            <li>• No clear view of delays across teams</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-900/10 p-6">
          <p className="text-sm font-semibold text-white">After Docketra</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-200">
            <li>• One shared place for clients, work, and documents</li>
            <li>• Every task has an owner and a visible next step</li>
            <li>• Leaders can quickly spot delays and unblock teams</li>
          </ul>
        </div>
      </motion.div>

      <motion.div className="mt-6 grid gap-4 sm:grid-cols-3" {...SECTION_REVEAL}>
        {STATS.map((item, index) => (
          <motion.div
            key={item.label}
            className="rounded-xl border border-gray-700 bg-gray-800 p-4"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.08 }}
            viewport={{ once: true }}
          >
            <p className="text-3xl font-semibold text-white">
              {item.value}
              {item.suffix}
            </p>
            <p className="mt-1 text-xs text-gray-300">{item.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </Container>
  </section>
);

const UseCasesSection = () => (
  <section id="use-cases" className="w-full bg-white py-16 md:py-20 border-y border-gray-100">
    <Container>
      <motion.div {...SECTION_REVEAL}>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Who it is for</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">
          Built for firms that need dependable day-to-day execution.
        </h2>
      </motion.div>
      <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10" {...SECTION_REVEAL}>
        {USE_CASES.map((item) => (
          <div key={item} className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-700">
            {item}
          </div>
        ))}
      </motion.div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section id="pricing" className="w-full bg-gray-900 text-white py-20">
    <Container>
      <motion.div className="text-center" {...SECTION_REVEAL}>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
          Give your firm one clear system to run work.
        </h2>
        <p className="text-lg text-gray-300 mt-4 max-w-2xl mx-auto leading-relaxed">
          Docketra helps your team stay organized, accountable, and on time without adding complexity.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Start free early access
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-gray-600 text-white text-sm hover:border-gray-400 transition-colors"
          >
            Talk to our team
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Contact:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-white">
            {CONTACT_EMAIL}
          </a>
        </p>
      </motion.div>
    </Container>
  </section>
);

export const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="w-full bg-white text-gray-900">
      <HeroSection onExplore={() => handleSectionNavigation('how-it-works')} />
      <ProblemSolutionSection />
      <FeatureHighlightsSection />
      <HowItWorksSection />
      <VisualProofSection />
      <UseCasesSection />
      <FinalCtaSection />

      <footer className="bg-white border-t border-gray-100 py-12">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Link to="/" className="font-semibold text-gray-900">
              Docketra
            </Link>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
              <button type="button" onClick={() => handleSectionNavigation('features')} className="hover:text-gray-900">
                Features
              </button>
              <button type="button" onClick={() => handleSectionNavigation('pricing')} className="hover:text-gray-900">
                Early Access
              </button>
              <Link to="/terms" className="hover:text-gray-900">
                Terms of Use
              </Link>
              <Link to="/privacy" className="hover:text-gray-900">
                Privacy Policy
              </Link>
              <Link to="/security" className="hover:text-gray-900">
                Data &amp; Security
              </Link>
              <Link to="/acceptable-use" className="hover:text-gray-900">
                Acceptable Use
              </Link>
              <Link to="/about" className="hover:text-gray-900">
                About
              </Link>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© 2026 Docketra. All rights reserved.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-medium text-gray-900 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </Container>
      </footer>
    </div>
  );
};
