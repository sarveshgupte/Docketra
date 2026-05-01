import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Container from '../../components/layout/Container';

const CONTACT_EMAIL = 'hello@docketra.com';

const REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
  viewport: { once: true, amount: 0.15 },
};

/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
const HomeNav = ({ onNav }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Why', id: 'why' },
    { label: 'Product', id: 'product' },
    { label: 'In practice', id: 'in-practice' },
    { label: 'Trust', id: 'trust' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <Container>
        <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight">
            Docketra
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {navLinks.map(({ label, id }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNav(id)}
                  className="hover:text-slate-900 transition-colors"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Login</Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
            >
              Request early access
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 pb-4 pt-2">
            <ul className="flex flex-col gap-1">
              {navLinks.map(({ label, id }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => { onNav(id); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    {label}
                  </button>
                </li>
              ))}
              <li className="mt-2 px-4">
                <Link to="/login" className="block text-center h-9 leading-9 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors" onClick={() => setMenuOpen(false)}>Login</Link>
              </li>
              <li className="mt-2 px-4">
                <Link
                  to="/signup"
                  className="block text-center h-9 leading-9 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Request early access
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Container>
    </header>
  );
};

/* ─────────────────────────────────────────────
   HERO DASHBOARD MOCK
───────────────────────────────────────────── */
const HeroDashboardMock = () => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
    {/* Browser chrome */}
    <div className="flex items-center gap-1.5 bg-slate-100 px-4 py-2.5 border-b border-slate-200">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="ml-3 flex-1 rounded bg-white border border-slate-200 text-xs text-slate-400 px-2 py-0.5">
        app.docketra.com
      </span>
    </div>

    {/* Diagram body */}
    <div className="p-6 bg-slate-50">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5 text-center">
        Company Brain · Illustrative view
      </p>

      {/* Centre node */}
      <div className="flex justify-center mb-4">
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-3 text-center shadow-sm">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Company Brain</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Your firm's living memory</p>
        </div>
      </div>

      {/* Connected nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Clients', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Active Work', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'Documents', color: 'bg-violet-50 border-violet-200 text-violet-700' },
          { label: 'Deadlines', color: 'bg-rose-50 border-rose-200 text-rose-700' },
          { label: 'Knowledge Intake', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { label: 'Processes & Checklists', color: 'bg-teal-50 border-teal-200 text-teal-700' },
        ].map(({ label, color }) => (
          <div
            key={label}
            className={`rounded-lg border px-3 py-2.5 text-center text-xs font-medium ${color}`}
          >
            {label}
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[10px] text-slate-400">
        Illustrative view · BYOS · Firm-controlled storage
      </p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   HERO SECTION
───────────────────────────────────────────── */
const HeroSection = ({ onExplore }) => (
  <section className="w-full bg-gradient-to-b from-slate-50 to-white py-20 md:py-28">
    <Container>
      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10 items-center">
        <motion.div className="md:col-span-6 lg:col-span-5" {...REVEAL}>
          <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 mb-5">
            For CS · CA · Legal · Tax · Advisory firms
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-slate-900">
            Run your firm with memory.
          </h1>

          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Docketra connects your firm's clients, work, documents, deadlines, processes, and team knowledge into one living workspace.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow hover:bg-amber-600 transition-colors"
            >
              Request early access
            </Link>
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              See how it works
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Bring your own storage
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              AI off by default
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Built in India
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="md:col-span-6 lg:col-span-7"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          viewport={{ once: true }}
        >
          <HeroDashboardMock />
        </motion.div>
      </div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   PROBLEM SECTION
───────────────────────────────────────────── */
const PAIN_POINTS = [
  { question: '"Who owns this work?"', liveIn: 'WhatsApp group' },
  { question: '"What did we promise the client?"', liveIn: 'Email thread, somewhere' },
  { question: '"Where are the documents?"', liveIn: 'Drive folder #14' },
  { question: '"What was done last year?"', liveIn: 'Ask the senior who left' },
  { question: '"Which checklist should be followed?"', liveIn: 'Excel v7_final_v2' },
  { question: '"What is pending from the client?"', liveIn: 'Memory of one partner' },
];

const ProblemSection = () => (
  <section id="why" className="w-full bg-slate-900 text-white py-20 md:py-28">
    <Container>
      <motion.div {...REVEAL}>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
          The problem
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl leading-tight">
          Firm context lives everywhere, and nowhere.
        </h2>
        <p className="mt-5 text-lg text-slate-300 max-w-2xl leading-relaxed">
          Professional firms lose context across WhatsApp, Excel, email, Google Drive, and individual staff memory. Every question becomes an investigation.
        </p>
      </motion.div>

      <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12" {...REVEAL}>
        {PAIN_POINTS.map(({ question, liveIn }) => (
          <div
            key={question}
            className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 hover:border-slate-500 transition-colors"
          >
            <p className="text-sm font-semibold text-white">{question}</p>
            <p className="mt-2 text-xs text-slate-400">
              lives in: <span className="text-amber-400 font-medium">{liveIn}</span>
            </p>
          </div>
        ))}
      </motion.div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   SOLUTION SECTION
───────────────────────────────────────────── */
const SolutionSection = () => (
  <section className="w-full bg-white py-20 md:py-24">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-4">
          The solution
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-slate-900">
          Scattered firm knowledge becomes connected, executable memory.
        </h2>
        <p className="mt-5 text-lg text-slate-600 leading-relaxed">
          Docketra is the Company Brain — one place where clients, work, documents, deadlines, processes, and decisions live as one connected system.
        </p>
      </motion.div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   PRODUCT PILLARS SECTION
───────────────────────────────────────────── */
const WorkPillarMock = () => (
  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 divide-y divide-slate-100 text-xs overflow-hidden">
    {[
      { title: 'Annual Filing – Lumen Labs', status: 'In Progress', owner: 'Priya B.' },
      { title: 'ROC Compliance – Veritas Co.', status: 'Pending Client', owner: 'Arjun S.' },
      { title: 'GST Return Q3 – GreenLeaf', status: 'Under Review', owner: 'Anand K.' },
    ].map((row) => (
      <div key={row.title} className="flex items-start justify-between px-3 py-2.5 gap-2">
        <span className="text-slate-700 font-medium truncate flex-1">{row.title}</span>
        <span className="text-slate-400 whitespace-nowrap">{row.status}</span>
      </div>
    ))}
  </div>
);

const ClientMemoryMock = () => (
  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs">
    <p className="font-semibold text-blue-900">GreenLeaf Foods Pvt Ltd</p>
    <p className="text-blue-500 mt-0.5">Client since 2021 · BYOS storage linked</p>
    <div className="mt-2 space-y-1 text-blue-700">
      <p>Annual Filing FY 24-25 · Preparer: Priya Bhatt</p>
      <p>Form AOC-4 due Oct 30 · Form MGT-7 due Nov 28</p>
      <p className="text-blue-500">Instruction: CFO reviews all drafts before sign-off</p>
    </div>
  </div>
);

const KnowledgeIntakeMock = () => (
  <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs">
    <p className="font-semibold text-sky-900">New Enquiry</p>
    <p className="text-sky-600 mt-0.5">Aarav Mehta · Lumen Labs Pvt Ltd</p>
    <div className="mt-2 space-y-1 text-sky-700">
      <p>ROC compliance for new Pvt Ltd</p>
      <p>Status: <span className="font-medium">Awaiting company details</span></p>
      <p className="text-sky-500">Assigned to Priya B. · 24h SLA</p>
    </div>
  </div>
);

const CompanyBrainMock = () => (
  <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs">
    <p className="font-semibold text-amber-900">Connected context</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {['GreenLeaf Files', 'Annual Checklist', 'AOC-4 Template', 'FY 23-24 Notes'].map((tag) => (
        <span key={tag} className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-amber-700">
          {tag}
        </span>
      ))}
    </div>
    <p className="mt-2 text-amber-700">
      Open the right context without starting from zero.
    </p>
  </div>
);

const PILLARS = [
  {
    number: '01',
    title: 'Work',
    body: 'Dockets, tasks, assignees, and status in one shared view. Every job has an owner.',
    mock: <WorkPillarMock />,
  },
  {
    number: '02',
    title: 'Clients',
    body: 'Client memory that persists year after year — instructions, history, and live context.',
    mock: <ClientMemoryMock />,
  },
  {
    number: '03',
    title: 'Knowledge Intake',
    body: 'Capture enquiries, scope requests, and follow-ups before they live only in someone\'s inbox.',
    mock: <KnowledgeIntakeMock />,
  },
  {
    number: '04',
    title: 'Company Brain',
    body: 'Connects work, clients, and knowledge into linked firm memory — from first enquiry to year-after-year compliance.',
    mock: <CompanyBrainMock />,
  },
];

const ProductPillarsSection = () => (
  <section id="product" className="w-full bg-slate-50 py-20 md:py-28">
    <Container>
      <motion.div {...REVEAL}>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-4">
          Product
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          Four pillars. One brain.
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl">
          Each pillar stands alone. Together, they remember everything your firm has ever done.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mt-12">
        {PILLARS.map((pillar, idx) => (
          <motion.div
            key={pillar.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.07 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold text-amber-500 tracking-widest mb-2">{pillar.number}</p>
            <h3 className="text-xl font-bold text-slate-900">{pillar.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{pillar.body}</p>
            {pillar.mock}
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   FLOW EXAMPLE / IN PRACTICE
───────────────────────────────────────────── */
const PcsScenario = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
      PCS firm · example workflow
    </p>
    <h3 className="text-lg font-bold text-slate-900 mb-4">
      From enquiry to long-term client
    </h3>
    <ol className="space-y-3">
      {[
        'Founder enquires: ROC compliance for new Pvt Ltd.',
        'Captures enquiry and asks for company details, CIN, directors.',
        'Follow-up assigned to Priya B. with 24h SLA.',
        'Call recorded: scope discussed, fee accepted in principle.',
        'Proposal sent. Status: Awaiting client signature.',
        'Converted to active client. Annual compliance docket opened.',
        "Last year's filings, notes & instructions attached.",
      ].map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-600">
          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
    <p className="mt-4 text-[11px] text-slate-400">Illustrative timeline · not automated</p>
  </div>
);

const GreenLeafCard = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
      Existing client · example
    </p>
    <h3 className="text-lg font-bold text-slate-900 mb-1">
      Year-after-year, nothing forgotten
    </h3>

    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-semibold text-blue-900 text-sm">GreenLeaf Foods Pvt Ltd</p>
          <p className="text-xs text-blue-500">CIN: U15549MH2019PTC000001 · Client since 2021</p>
        </div>
        <span className="rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium px-2 py-0.5">
          Active
        </span>
      </div>

      <div className="mt-3 border-t border-blue-100 pt-3 space-y-1.5 text-xs text-blue-800">
        <p><span className="font-medium">Docket:</span> Annual Filing FY 24-25</p>
        <p><span className="font-medium">Preparer:</span> Priya Bhatt</p>
        <p><span className="font-medium">Reviewer:</span> Anand Kulkarni</p>
        <p><span className="font-medium">Form AOC-4</span> due Oct 30 · <span className="font-medium">Form MGT-7</span> due Nov 28</p>
        <p>Checklist: 7 of 12 complete</p>
        <p className="text-blue-500">FY 23-24 reference attached</p>
        <p className="text-amber-700 font-medium">Instruction: CFO reviews all drafts before sign-off</p>
      </div>
    </div>
  </div>
);

const FlowExampleSection = () => (
  <section id="in-practice" className="w-full bg-white py-20 md:py-28">
    <Container>
      <motion.div {...REVEAL}>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-4">
          In practice
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          Two ways Docketra holds the thread.
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl">
          From first enquiry to year-after-year compliance, the firm never starts from zero again.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mt-12">
        <motion.div {...REVEAL}><PcsScenario /></motion.div>
        <motion.div {...REVEAL}><GreenLeafCard /></motion.div>
      </div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   TRUST SECTION
───────────────────────────────────────────── */
const TRUST_CARDS = [
  {
    title: 'Bring Your Own Storage',
    body: 'Your documents stay in storage you control — Google Drive, S3, or another provider. Use your own cloud storage where configured. If BYOS is skipped, Docketra default storage may be used.',
  },
  {
    title: 'Operational context only',
    body: 'Docketra stores work metadata, assignments, notes, and deadlines. Document storage can stay in your connected cloud setup, or use Docketra default storage when BYOS is not configured.',
  },
  {
    title: 'AI off by default',
    body: 'No document parsing, no AI suggestions, no vector indexing without your explicit opt-in. You decide what the system does.',
  },
];

const TrustSection = () => (
  <section id="trust" className="w-full bg-slate-900 text-white py-20 md:py-28">
    <Container>
      <motion.div {...REVEAL}>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
          Trust
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight max-w-3xl">
          Quiet by design. Yours by default.
        </h2>
        <p className="mt-4 text-lg text-slate-300 max-w-2xl leading-relaxed">
          Built for firms that take confidentiality seriously. Storage configuration should be clear to the primary admin.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        {TRUST_CARDS.map((card, idx) => (
          <motion.div
            key={card.title}
            className="rounded-2xl border border-slate-700 bg-slate-800 p-6 hover:border-amber-500/50 transition-colors"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
            viewport={{ once: true }}
          >
            <h3 className="text-base font-bold text-white">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">{card.body}</p>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   FINAL CTA SECTION
───────────────────────────────────────────── */
const FinalCtaSection = () => (
  <section id="early-access" className="w-full bg-gradient-to-br from-amber-50 to-white py-24 md:py-32">
    <Container>
      <motion.div className="text-center max-w-3xl mx-auto" {...REVEAL}>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          Build your firm's memory before it walks out the door.
        </h2>
        <p className="mt-5 text-lg text-slate-600 leading-relaxed">
          Docketra is in early access for select Indian professional firms. Join the next cohort.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow hover:bg-amber-600 transition-colors"
          >
            Request early access
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Email us directly
          </a>
        </div>

        <p className="mt-5 text-sm text-slate-400">
          Secure onboarding · Role-based access · BYOS-first architecture
        </p>
      </motion.div>
    </Container>
  </section>
);

/* ─────────────────────────────────────────────
   MARKETING FOOTER
───────────────────────────────────────────── */
const MarketingFooter = () => (
  <footer className="bg-white border-t border-slate-100 py-12">
    <Container>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
        <div>
          <Link to="/" className="font-bold text-slate-900 text-lg">
            Docketra
          </Link>
          <p className="mt-1 text-sm text-slate-500">Run your firm with memory.</p>
          <p className="text-sm text-slate-400">Built for professional firms in India</p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Product</p>
            <Link to="/features" className="text-sm text-slate-600 hover:text-slate-900">Features</Link>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900">About</Link>
            <Link to="/contact" className="text-sm text-slate-600 hover:text-slate-900">Contact</Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Legal</p>
            <Link to="/terms" className="text-sm text-slate-600 hover:text-slate-900">Terms</Link>
            <Link to="/privacy" className="text-sm text-slate-600 hover:text-slate-900">Privacy</Link>
            <Link to="/security" className="text-sm text-slate-600 hover:text-slate-900">Security</Link>
            <Link to="/acceptable-use" className="text-sm text-slate-600 hover:text-slate-900">Acceptable Use</Link>
          </div>
        </nav>
      </div>

      <div className="mt-10 border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-400">© 2026 Docketra. All rights reserved.</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-slate-500 hover:text-slate-900 hover:underline">
          {CONTACT_EMAIL}
        </a>
      </div>
    </Container>
  </footer>
);

/* ─────────────────────────────────────────────
   PAGE ROOT
───────────────────────────────────────────── */
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
    }
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
      <HomeNav onNav={handleSectionNavigation} />
      <HeroSection onExplore={() => handleSectionNavigation('why')} />
      <ProblemSection />
      <SolutionSection />
      <ProductPillarsSection />
      <FlowExampleSection />
      <TrustSection />
      <FinalCtaSection />
      <MarketingFooter />
    </div>
  );
};
