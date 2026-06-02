import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import Container from '../../components/layout/Container';

const REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.12 },
};

const HERO_METRICS = [
  { label: 'Active dockets', value: '124', note: '42 due this week', color: 'border-amber-200' },
  { label: 'QC review queue', value: '09', note: '3 need internal sign-off', color: 'border-indigo-200' },
  { label: 'Client memory facts', value: '2.4k', note: 'CFS, docs, audit trails', color: 'border-emerald-200' },
];

const PAIN_POINTS = [
  { emoji: '📲', title: 'Work is scattered', body: 'WhatsApp, Excel, email, and loose folders carry completely different versions of the truth.' },
  { emoji: '🧠', title: 'Context sits in heads', body: 'Client facts, filing exceptions, and reviewer preferences disappear when a team member is out.' },
  { emoji: '⏳', title: 'Deadlines surprise teams', body: 'Primary Admins, Admins, and Managers only see risk after filings are already late, stuck in QC, or missing client signatures.' },
  { emoji: '🔁', title: 'Repeat work restarts', body: 'Teams exhaustively rebuild context for recurring monthly/annual filings instead of reusing firm memory.' },
  { emoji: '🎯', title: 'Ownership gets fuzzy', body: 'Managers constantly chase status updates because execution and accountability are not linked at the docket level.' },
  { emoji: '✅', title: 'QC is informal', body: 'Review handoffs, corrections, and final filing confidence lack a clear, traceable audit trail.' },
];

const PILLARS = [
  {
    emoji: '🧠',
    title: 'Client Memory & CFS',
    body: 'Client profile, CFS, documents, and prior dockets stay connected to the work with secure BYO Storage (Google Drive, S3, OneDrive).',
    tag: 'Context OS'
  },
  {
    emoji: '⚡',
    title: 'Work Execution',
    body: 'Worklist, Workbaskets, QC Workbaskets, and docket lifecycle states keep daily execution moving with strict B2B Tenant Isolation.',
    tag: 'Execution OS'
  },
  {
    emoji: '🎛️',
    title: 'Firm Control & AI',
    body: 'Role hierarchy, team access, reports, and secure BYOAI keys give Primary Admins, Admins, and Managers a calm, intelligent command layer.',
    tag: 'Command Layer'
  },
  {
    emoji: '🛡️',
    title: 'Trust & Traceability',
    body: 'Audit history, role-based access, storage visibility, and action records make work easier to verify with zero storage bleed.',
    tag: 'Compliance'
  },
];

const WORKFLOW_STEPS = [
  { emoji: '🏢', title: 'Initialize Workspace', body: 'Set up your firm boundaries, configure custom roles (Manager, Admin, Primary Admin), and secure team access.' },
  { emoji: '👥', title: 'Build Client & Team Memory', body: 'Import clients and map team accountability. Establish default Client scopes for absolute isolation.' },
  { emoji: '🧺', title: 'Route Workbaskets & QC Queues', body: 'Configure functional queues (HR, Finance, Accounts, Operations) with strict internal QC sign-off steps.' },
  { emoji: '📝', title: 'Trigger Smart Dockets', body: 'Launch trackable compliance worklists, recurring filings, and ad-hoc client requests in one click.' },
  { emoji: '📊', title: 'Trace, Audit, & Report', body: 'Track real-time metrics, QC review bottlenecks, and comprehensive tamper-proof audit trails on one safety dashboard.' },
];

const OWNER_SIGNALS = [
  { value: 'Atomic tenant isolation', label: 'B2B multi-tenancy ensures completely segregated workspace boundaries.' },
  { value: 'Zero billing surprises', label: 'No payment cards or hidden paywalls during our free testing onboarding phase.' },
  { value: 'Docket-level QC', label: 'Structured handoffs and review states ensure no filing leaves the firm unverified.' },
  { value: 'Full audit telemetry', label: 'Trace every login, action, and configuration change with clean audit trails.' },
];

const USE_CASES = [
  'Indian CS annual compliance filings',
  'ROC and statutory compliance tracking',
  'GST, TDS, and tax recurring dockets',
  'Legal matter task management',
  'Client Fact Sheet & document memory',
  'Internal firm operations execution',
];

const TRUST_POINTS = [
  { emoji: '🛡️', title: 'Strict IDOR Prevention', body: 'All resources are strictly validated against the authenticated tenant scope.' },
  { emoji: '🔐', title: 'Encrypted BYOAI Keys', body: 'API credentials are encrypted at rest using envelope keys.' },
  { emoji: '🧾', title: 'Full Audit Logging', body: 'Traceable audit logs capture auth, security, and administrative events.' },
  { emoji: '🙈', title: 'Zero Storage Bleed', body: 'Tenant storage boundaries are cryptographically and logically isolated.' },
];

const ProductMockup = () => (
  <div className="relative">
    {/* Decorative Glowing Orbs */}
    <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
    <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

    <div className="absolute -right-4 -top-5 z-20 hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-xl shadow-amber-200/30 sm:block">
      ✨ 100% Free Testing Phase Active
    </div>

    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_32px_96px_-24px_rgba(15,23,42,0.18)]">
      {/* Browser Bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-950 px-4 py-3.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-400/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
        </div>
        <div className="ml-4 rounded-full bg-white/10 px-4 py-1 text-[11px] font-medium tracking-wide text-slate-300">
          app.docketra.com/workspace/mehta-co
        </div>
      </div>

      <div className="grid min-h-[440px] lg:grid-cols-[190px_1fr]">
        {/* Workspace Sidebar */}
        <aside className="hidden border-r border-slate-100 bg-slate-50/50 p-4 lg:block">
          <div className="mb-6 rounded-2xl bg-slate-900 p-3 text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Firm Tenant</p>
            <p className="mt-0.5 text-sm font-extrabold truncate">Mehta & Co. CS</p>
          </div>
          <div className="space-y-1.5 text-xs font-semibold text-slate-600">
            {[
              { label: '📥 Live Worklist', active: true },
              { label: '🧺 Workbaskets', active: false },
              { label: '📝 Dockets', active: false },
              { label: '🧠 Client CFS', active: false },
              { label: '📊 Safety Reports', active: false },
              { label: '🔐 Access & Keys', active: false }
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
                  item.active
                    ? 'bg-amber-500/10 text-amber-950 font-bold border-l-4 border-amber-500'
                    : 'hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Workspace Dashboard */}
        <main className="bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700">Calm Command Center</p>
              <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Workspace Execution Snapshot</h3>
            </div>
            <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Isolated Tenant Boundary
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {HERO_METRICS.map((metric) => (
              <div key={metric.label} className={`rounded-2xl border ${metric.color} bg-white p-4 shadow-sm transition-all hover:shadow-md`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</p>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">{metric.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            {/* Live Queue */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">High-Priority Filings</p>
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                  ⚡ Live Queue
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {[
                  ['CS Annual Filing', 'GreenLeaf Foods', 'Due tomorrow', 'Priya (Manager)'],
                  ['GST return', 'Apex Retail', 'Waiting client docs', 'Arjun (Associate)'],
                  ['Board resolution', 'Nova Labs', 'QC review', 'Meera (Admin)'],
                ].map(([work, client, status, owner]) => (
                  <div key={`${work}-${client}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3.5 hover:bg-slate-50/40">
                    <div>
                      <p className="font-bold text-slate-950 text-[13px]">{work}</p>
                      <p className="text-slate-500 mt-0.5">Client: <span className="font-semibold text-slate-700">{client}</span> · Owner: {owner}</p>
                    </div>
                    <span className="self-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Memory highlight */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🧠</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">CFS Fact Sheet Card</p>
                </div>
                <div className="mt-4 space-y-2.5 text-[11px] leading-relaxed text-slate-300">
                  <p className="rounded-xl bg-white/[0.07] border border-white/[0.05] p-2.5">
                    <span className="font-bold text-white block mb-0.5">⚠️ DSC Expiry Alert</span>
                    Director DSC expires in April 2026. Prioritize early sign-off.
                  </p>
                  <p className="rounded-xl bg-white/[0.07] border border-white/[0.05] p-2.5">
                    <span className="font-bold text-white block mb-0.5">👥 Handoff Rules</span>
                    Requires Meera (Admin) review before final submission.
                  </p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4">Isolated Firm Knowledge</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
);

const SectionEyebrow = ({ children }) => (
  <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">{children}</p>
);

const HeroSection = ({ onExplore }) => (
  <section className="relative overflow-hidden bg-gradient-to-b from-[#fffaf1] via-white to-white py-16 md:py-24">
    {/* Grid Overlay */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.08),transparent_40%)]" />

    <Container className="relative">
      <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div {...REVEAL}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-900 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Built for Indian professional firms
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            The Company Brain for Indian professional firms.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
            Docketra brings client memory, dockets, worklists, workbaskets, QC, reports, and audit trails into one secure workspace built for CS, CA, law, and compliance teams.
          </p>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-500">
            Give Primary Admins, Admins, and Managers one centralized command center for deadline visibility, employee accountability, and secure client memory that grows with the firm.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-7 text-xs font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-850 hover:shadow-xl hover:scale-[1.02]">
              Create workspace
            </Link>
            <Link to="/find-workspace" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-xs font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:scale-[1.02]">
              Find workspace
            </Link>
            <button type="button" onClick={onExplore} className="inline-flex h-12 items-center justify-center rounded-xl border border-transparent px-5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100/50">
              See How It Works
            </button>
          </div>

          <div className="mt-8 grid gap-3 text-xs text-slate-700 sm:grid-cols-3">
            {['🔐 Atomic multitenancy', '🤖 Secure BYOAI integration', '✅ Structured internal QC'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-md px-4 py-3.5 shadow-sm font-semibold">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, x: 20 }}
          whileInView={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
        >
          <ProductMockup />
        </motion.div>
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="relative scroll-mt-24 bg-slate-950 py-20 text-white overflow-hidden">
    {/* Background elements */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.08),transparent_50%)]" />
    <Container className="relative">
      <motion.div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]" {...REVEAL}>
        <div>
          <SectionEyebrow>😵 Why Traditional Tracking Fails</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl leading-tight">Execution breaks when work and memory live in different places.</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Generic sheets and messengers track actions, not understanding. Docketra is engineered for firm owners who demand full deadline transparency without constant follow-ups.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PAIN_POINTS.map((point) => (
            <li key={point.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-sm transition-all hover:border-white/[0.15] hover:bg-white/[0.06]">
              <div className="text-2xl" aria-hidden="true">{point.emoji}</div>
              <h3 className="mt-3 font-bold text-white text-[15px]">{point.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{point.body}</p>
            </li>
          ))}
        </ul>
      </motion.div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-24 bg-slate-50/50 py-20">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <SectionEyebrow>🏗️ Core Operating Spine</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
          Four Pillars: Company Brain + Structured Workspace OS
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          The structural foundation built to organize, execute, and safeguard critical professional operations.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {PILLARS.map((pillar) => (
          <motion.div key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300" {...REVEAL}>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl shadow-sm" aria-hidden="true">
                {pillar.emoji}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-950">{pillar.title}</h3>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold text-slate-700">
                    {pillar.tag}
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{pillar.body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-24 bg-white py-20">
    <Container>
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <motion.div {...REVEAL}>
          <SectionEyebrow>🧭 Operating Workflow</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl leading-tight">Setting up the system.</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Docketra structures your firm from first setup, turning daily filings and recurring dockets into permanent operating memory.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-500/5 p-4 border-l-4 border-amber-500">
            <p className="text-xs font-semibold text-amber-900 leading-relaxed">
              💡 **Pilot Highlight**: Onboard your firm during this testing phase, configure workbaskets, and start executing immediately with zero upfront costs.
            </p>
          </div>
        </motion.div>
        <div className="grid gap-3.5">
          {WORKFLOW_STEPS.map((step, index) => (
            <motion.div key={step.title} className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-sm hover:border-slate-350 hover:bg-white transition-all" {...REVEAL}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-sm">
                {step.emoji}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step {index + 1}</p>
                <h3 className="mt-0.5 font-extrabold text-slate-950 text-[14px]">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Container>
  </section>
);

const WhyNotTaskManagerSection = () => (
  <section id="pilot-readiness" className="scroll-mt-24 bg-slate-50/50 py-20">
    <Container>
      <motion.div className="rounded-[2.5rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl md:p-10 relative overflow-hidden" {...REVEAL}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.08),transparent_50%)]" />
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] relative">
          <div>
            <SectionEyebrow>🎯 Built For Testing & Safety</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl leading-tight">Free testing-phase onboarding active.</h2>
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Unlike generic task managers that hide features behind credit card requests, Docketra supports a fully transparent, robust testing period. Onboard firms for testing with zero payment obligations.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
                Limit: 10 Users/Firm
              </span>
              <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-slate-300">
                100% Free Pilot
              </span>
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {OWNER_SIGNALS.map((signal) => (
              <div key={signal.value} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
                <h3 className="font-extrabold text-[14px] text-white">{signal.value}</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{signal.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const UseCasesSection = () => (
  <section className="bg-gradient-to-b from-white to-[#fffaf1] py-20">
    <Container>
      <motion.div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" {...REVEAL}>
        <div>
          <SectionEyebrow>📌 Specialized Indian Use Cases</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Engineered for real firm filings.</h2>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-slate-500">
          Start with one critical workflow, then expand Docketra across your teams as client memory and QC confidence accumulate.
        </p>
      </motion.div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((copy) => (
          <div key={copy} className="rounded-2xl border border-amber-200/50 bg-white p-4.5 text-xs font-bold text-slate-800 shadow-sm hover:border-amber-400 hover:shadow-md transition-all">
            ✨ {copy}
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-24 bg-white py-20 border-t border-slate-100">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <SectionEyebrow>🛡️ Cryptographic Boundaries & Trust</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
          Zero-trust security architecture.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Docketra provides hardened access layers designed specifically for sensitive client data and credentials.
        </p>
      </motion.div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TRUST_POINTS.map((point) => (
          <div key={point.title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 hover:border-slate-350 hover:bg-white transition-all">
            <div className="text-2xl" aria-hidden="true">{point.emoji}</div>
            <h3 className="mt-3 font-extrabold text-slate-950 text-[14px]">{point.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{point.body}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const FutureAiSection = () => (
  <section className="bg-slate-950 py-20 text-white relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(99,102,241,0.06),transparent_50%)]" />
    <Container className="relative">
      <motion.div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" {...REVEAL}>
        <div>
          <SectionEyebrow>🤖 AI-Ready Infrastructure</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl leading-tight">Assistive intelligence designed with privacy guardrails.</h2>
        </div>
        <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-sm">
          <p className="text-xs leading-relaxed text-slate-300">
            Docketra Intelligence enables CA/CS firms to safely leverage advanced LLMs. Safely auto-summarize case documents, draft statutory resolution emails, refine task briefs, and receive intelligent routing recommendations using your own secure API keys.
          </p>
          <div className="mt-5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-[11px] font-bold text-amber-200 leading-relaxed">
              🔐 **Zero Data Retention Policy**: All GenAI endpoints redact errors and enforce zero-data retention by LLM providers, ensuring absolute client secrecy.
            </p>
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="bg-gradient-to-b from-[#fffaf1] via-white to-slate-50 py-20 border-t border-slate-100">
    <Container>
      <motion.div className="mx-auto max-w-4xl text-center" {...REVEAL}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">🚀 Set Up Your Operating Layers</p>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 md:text-5xl">Establish your firm’s Company Brain.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600">
          Begin with client memory, robust role isolation, and structured workbaskets. Serious compliance software designed for firm leaders who require calm accountability.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-8 text-xs font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-900 transition-all hover:scale-[1.02]">
            Create workspace
          </Link>
          <Link to="/find-workspace" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-8 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition-all hover:scale-[1.02]">
            Find workspace
          </Link>
        </div>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-12 text-slate-300 border-t border-white/[0.05]">
    <Container>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/" className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs text-slate-950 font-extrabold">✨</span>
            Docketra
          </Link>
          <p className="mt-2 text-xs text-slate-400 max-w-sm leading-relaxed">
            Enterprise operating platform for Indian CS, CA, legal, and statutory compliance firms. Built on atomic tenant isolation.
          </p>
        </div>

        <nav aria-label="Footer legal navigation" className="flex flex-wrap items-center gap-x-6 gap-y-3 font-semibold text-xs text-slate-400">
          <Link to="/terms" className="transition-colors hover:text-white">Terms</Link>
          <Link to="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <Link to="/security" className="transition-colors hover:text-white">Security</Link>
          <Link to="/acceptable-use" className="transition-colors hover:text-white">Acceptable Use</Link>
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
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25">
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
