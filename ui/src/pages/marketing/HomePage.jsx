import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Container from '../../components/layout/Container';

const HERO_TASKS = [
  { name: 'Review monthly filing checklist', status: 'In Progress', assignee: 'AR', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  { name: 'Collect final sign-off from approver', status: 'Pending', assignee: 'KP', tone: 'text-slate-700 bg-slate-100 border-slate-200' },
  { name: 'Submit compliance packet', status: 'Done', assignee: 'SJ', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'Attach supporting documents', status: 'In Progress', assignee: 'MN', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
];

const statusDotMap = {
  Pending: 'bg-slate-400',
  'In Progress': 'bg-amber-500',
  Done: 'bg-emerald-500',
};

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
  viewport: { once: true },
};

const FEATURES = [
  {
    icon: '\u2726',
    title: 'Centralized Firm Dashboard',
    body: 'Manage all your clients, cases, and team members from a single, secure platform. No more scattered spreadsheets or isolated WhatsApp groups.',
    benefit: '\u2192 One source of truth for every engagement',
  },
  {
    icon: '\u2a3f',
    title: 'Granular Role-Based Access',
    body: "Assign roles to Partners, Admins, Managers, and team members. Each person sees exactly what they're authorized to see \u2014 enforced server-side, not client-side.",
    benefit: '\u2192 Data privacy built in by design',
  },
  {
    icon: '\u27f3',
    title: 'Standardized Workflow Engine',
    body: 'Turn chaotic processes into repeatable, stage-gated workflows. Set clear checkpoints from intake to resolution with SLA-aware tracking and due-date enforcement.',
    benefit: '\u2192 Every engagement runs to the same standard',
  },
  {
    icon: '\u23f1',
    title: 'Automated Audit Trails',
    body: 'Every action \u2014 status change, document upload, approval decision \u2014 is automatically logged with a user ID and timestamp you cannot edit or delete.',
    benefit: '\u2192 \u201cWho approved this?\u201d answered in seconds',
  },
  {
    icon: '\u2b21',
    title: 'Workbasket \u2192 Worklist Triage',
    body: 'Incoming work lands in a firm-level Workbasket for prioritization. Admins pull dockets into execution Worklists with clear ownership and due dates assigned.',
    benefit: '\u2192 Nothing falls through the cracks',
  },
  {
    icon: '\u25c8',
    title: 'Real-Time Operational Metrics',
    body: 'Partners and Primary Admins get a live dashboard view of overdue items, approval-risk dockets, and team workload \u2014 updated in real time.',
    benefit: '\u2192 Manage by signal, not by surprise',
  },
];

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

      {/* HERO */}
      <section className="w-full bg-white py-16 md:py-24">
        <Container className="grid min-w-0 grid-cols-1 gap-10 md:grid-cols-12 md:gap-8 lg:gap-12 items-start">

          {/* LEFT */}
          <motion.div className="w-full min-w-0 md:col-span-7" {...SECTION_REVEAL}>
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">
              Purpose-built for compliance, tax &amp; audit teams
            </p>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.06]">
              Your firm runs on deadlines. Docketra makes sure nothing slips.
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Docketra gives your firm a single place to assign work, track every docket from intake to resolution, and maintain an immutable audit trail \u2014 without chasing updates on WhatsApp.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-colors"
              >
                Create your free workspace \u2192
              </Link>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              No credit card required \u00b7 Free during Early Access \u00b7 Ready in minutes
            </p>
          </motion.div>

          {/* RIGHT \u2014 live workflow card */}
          <div className="w-full min-w-0 md:col-span-5">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                    Live workflow
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900">
                    Month-end Operations
                  </h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  4 active tasks
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {HERO_TASKS.map((task) => (
                  <div key={task.name} className="rounded-lg border border-gray-100 bg-white p-3 sm:p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium text-gray-900 leading-snug">
                        {task.name}
                      </p>
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                        {task.assignee}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDotMap[task.status]}`} />
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${task.tone}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </Container>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section className="w-full bg-gray-50 border-y border-gray-100 py-8">
        <Container>
          <p className="text-sm text-gray-500 text-center uppercase tracking-wide mb-5">
            Built for teams running compliance, tax, and audit workflows
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['CA & Tax Practices', 'Compliance Teams', 'Audit Firms', 'Consultancies'].map((label) => (
              <span key={label} className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 font-medium">
                {label}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {/* PROBLEM */}
      <section className="w-full bg-gray-900 text-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">The problem</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              Your team is capable. Your operations process is what\u2019s holding you back.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-6 mt-12" {...SECTION_REVEAL}>
            {[
              {
                title: 'Work lives in WhatsApp',
                body: 'Approvals get missed. Nobody knows the current status. Partners chase updates manually \u2014 and accountability disappears when something goes wrong.',
              },
              {
                title: 'Spreadsheets as the system of record',
                body: 'No ownership chain, no audit trail, no way to prove who did what and when. Reconstructing what happened after a missed deadline is painful and unreliable.',
              },
              {
                title: 'Every deadline is a fire drill',
                body: 'Without a structured queue, overdue items surface only after damage is done. Urgency becomes the default mode \u2014 and it burns out good teams.',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-3">{card.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </motion.div>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-lg text-gray-300 mt-10 max-w-2xl leading-relaxed">
              When client deadlines are non-negotiable, you need more than a to-do list. You need a system built for the way professional services firms actually work.
            </p>
            <button
              type="button"
              onClick={() => handleSectionNavigation('solution')}
              className="text-white underline underline-offset-4 text-sm mt-4 inline-block hover:text-gray-300"
            >
              See how Docketra fixes this \u2193
            </button>
          </motion.div>
        </Container>
      </section>

      {/* SOLUTION */}
      <section id="solution" className="w-full bg-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">The solution</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              One platform. Every docket. Complete clarity from intake to resolution.
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">
              Docketra gives your firm a structured, role-aware operations layer \u2014 so work gets assigned, tracked, approved, and completed the same way every time.
            </p>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-8 mt-12" {...SECTION_REVEAL}>
            {[
              {
                icon: '\u2699\ufe0f',
                title: 'Standardized Operations',
                body: 'Every docket follows a repeatable workflow \u2014 from Workbasket triage to Worklist execution to final sign-off. Consistency is built in, not enforced by memory.',
              },
              {
                icon: '\ud83d\udee1\ufe0f',
                title: 'Role-Aware Access Controls',
                body: 'Partners, Admins, Managers, and team members each operate within clearly defined permissions. No accidental exposure, no confusion about who can do what.',
              },
              {
                icon: '\ud83d\udccb',
                title: 'Immutable Audit Trail',
                body: 'Status changes, approvals, comments, and uploads are automatically logged with a timestamp and user ID. Your compliance trail is always complete and always ready.',
              },
            ].map((tile) => (
              <div key={tile.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
                <div className="text-2xl mb-4">{tile.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{tile.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{tile.body}</p>
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How it works</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
              From signup to fully operational in minutes.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-8 mt-12" {...SECTION_REVEAL}>
            {[
              {
                num: '01',
                title: 'Create your workspace',
                body: 'Sign up with your firm name and email. Docketra automatically provisions default categories, workbaskets, and a compliance-ready operating structure.',
              },
              {
                num: '02',
                title: 'Invite your team & assign roles',
                body: 'Invite Partners, Admins, Managers, and team members. Each role comes with pre-configured permissions. Assign a reporting hierarchy so accountability is clear from day one.',
              },
              {
                num: '03',
                title: 'Create dockets, track & approve',
                body: 'Create dockets with title, category, priority, and due date. Route them through the Workbasket \u2192 Worklist flow. Every status change and approval is automatically recorded in the audit trail.',
              },
            ].map((step) => (
              <div key={step.num} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <span className="inline-flex h-10 min-w-10 px-3 items-center justify-center rounded-lg bg-gray-50 text-xs font-semibold text-gray-700 border border-gray-200">
                  {step.num}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </motion.div>
          <motion.div className="mt-12 text-center" {...SECTION_REVEAL}>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-colors"
            >
              Create your workspace for free \u2192
            </Link>
            <p className="mt-3 text-sm text-gray-500">No setup complexity. No credit card. Start in minutes.</p>
          </motion.div>
        </Container>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full bg-white py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What Docketra does</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              Everything your firm needs. Nothing your team doesn\u2019t.
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">
              Built for compliance, tax, and audit teams who operate under strict deadlines, multi-client workloads, and regulatory scrutiny.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.07, 0.35) }}
                viewport={{ once: true }}
              >
                <div className="bg-blue-50 rounded-lg h-10 w-10 flex items-center justify-center text-blue-600 font-bold text-xl mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.body}</p>
                <p className="mt-4 text-xs font-medium text-blue-600">{feature.benefit}</p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Who uses Docketra</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              Built for professional services teams that operate under pressure.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-8 mt-12" {...SECTION_REVEAL}>
            {[
              {
                borderColor: 'border-l-amber-400',
                eyebrow: 'CA & TAX PRACTICES',
                heading: 'Run GST, ITR, and ROC filings without a single missed deadline',
                body: 'Docketra gives CA firms a structured queue for every client engagement. Assign filings to team members, track SLA timelines, and produce a complete audit trail for each submission.',
                quote: '\u201cIntake to filing, tracked at every step.\u201d',
              },
              {
                borderColor: 'border-l-blue-500',
                eyebrow: 'COMPLIANCE & AUDIT TEAMS',
                heading: 'Make every compliance checkpoint visible and accountable',
                body: 'Route intake through a Workbasket, assign ownership in a structured Worklist, and close every item with an immutable activity log \u2014 no more reconstructing what happened after the fact.',
                quote: '\u201cEvery status change. Every approval. Timestamped and signed.\u201d',
              },
              {
                borderColor: 'border-l-emerald-500',
                eyebrow: 'CONSULTANCIES',
                heading: 'Replace scattered tools with one operational platform',
                body: 'Consolidate work spread across WhatsApp, email, and spreadsheets into Docketra. Partners get real-time visibility. Team members get clear assignments. Clients get faster, more reliable delivery.',
                quote: '\u201cOne workspace. Every client. Full visibility.\u201d',
              },
            ].map((card) => (
              <div
                key={card.eyebrow}
                className={`rounded-2xl border bg-white p-8 shadow-sm border-l-4 ${card.borderColor}`}
              >
                <p className="text-xs uppercase tracking-widest font-semibold text-gray-400 mb-3">{card.eyebrow}</p>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 leading-snug">{card.heading}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
                <p className="text-gray-500 text-sm mt-4 italic">{card.quote}</p>
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* SECURITY */}
      <section className="w-full bg-white py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Security &amp; trust</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              Enterprise-grade security. Built into every layer.
            </h2>
          </motion.div>
          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12" {...SECTION_REVEAL}>
            {[
              {
                icon: '\ud83d\udd12',
                title: 'Multi-Tenant Isolation',
                body: "Every firm\u2019s data is fully isolated. Cross-firm data access is architecturally prevented \u2014 not just policy-blocked.",
              },
              {
                icon: '\ud83d\udee1\ufe0f',
                title: 'Role-Gated APIs',
                body: 'Every permission is enforced server-side. From SuperAdmin to team member, access is explicitly defined and cannot be bypassed client-side.',
              },
              {
                icon: '\ud83d\udccb',
                title: 'Immutable Audit Logs',
                body: 'All actions are logged with an immutable timestamp and user ID. No one can edit or delete the audit trail \u2014 including admins.',
              },
              {
                icon: '\ud83d\udd11',
                title: 'Secure Authentication',
                body: 'xID-based login with bcrypt hashing, 60-day password expiry, 5-generation password history, and forced first-login password change.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <div className="text-2xl mb-4">{item.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </motion.div>
          <motion.div className="mt-8 text-center" {...SECTION_REVEAL}>
            <Link to="/security" className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900">
              Read our full security documentation \u2192
            </Link>
          </motion.div>
        </Container>
      </section>

      {/* TESTIMONIALS */}
      <section className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What teams say</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
              From the teams that run on it.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-8 mt-12" {...SECTION_REVEAL}>
            {[
              {
                quote: "Before Docketra, I\u2019d spend the first hour of my day figuring out where things stood. Now I open the dashboard and the entire picture is there \u2014 overdue items, who owns what, what\u2019s waiting on approval.",
                name: 'A.R.',
                role: 'Operations Lead, CA Firm',
              },
              {
                quote: 'The audit trail feature alone justifies the switch. When a client questions a filing, I can show them exactly who acted, what changed, and when \u2014 down to the minute.',
                name: 'K.P.',
                role: 'Partner, Tax Consultancy',
              },
              {
                quote: 'We were managing 40+ active dockets per month in a spreadsheet. Docketra replaced that with a structured worklist that any team member can follow without needing a briefing.',
                name: 'S.J.',
                role: 'Compliance Manager, Mid-size Firm',
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <p className="text-amber-400 text-sm mb-4">\u2605\u2605\u2605\u2605\u2605</p>
                <p className="text-sm text-gray-700 leading-relaxed">\u201c{t.quote}\u201d</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                    {t.name.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
          <p className="text-xs text-gray-400 text-center mt-8">
            * Testimonials are representative of user feedback during Early Access.
          </p>
        </Container>
      </section>

      {/* PRICING */}
      <section id="pricing" className="w-full bg-white py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Pricing</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
              Start free. Scale as your firm grows.
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">
              We\u2019re in Early Access. Join now to lock in your free Starter workspace and help shape the future of Docketra.
            </p>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-8 mt-12" {...SECTION_REVEAL}>
            {/* Starter */}
            <div className="rounded-2xl border-2 border-blue-500 bg-white p-8 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Starter</h3>
                <span className="rounded-full bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1">Current Phase</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">Free</p>
              <p className="text-sm text-gray-500 mt-1">/ forever</p>
              <ul className="mt-6 space-y-2 flex-1">
                {['Up to 2 users (1 Admin + 1 Member)', 'Core docket management', 'Standard workflows', 'Immutable audit trail', 'Community support'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-emerald-500 mt-0.5">\u2713</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="mt-8 inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                Get Early Access \u2192
              </Link>
            </div>
            {/* Professional */}
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Professional</h3>
              <p className="text-3xl font-bold text-gray-900">TBA</p>
              <p className="text-sm text-gray-500 mt-1">/ coming soon</p>
              <ul className="mt-6 space-y-2 flex-1">
                {['Unlimited users', 'Advanced role permissions', 'Custom workflow templates', 'Priority support', 'Analytics & reporting'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">\u2713</span>{f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                className="mt-8 inline-flex items-center justify-center h-11 px-6 rounded-lg border border-gray-300 text-gray-400 text-sm font-medium cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
            {/* Enterprise */}
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Enterprise</h3>
              <p className="text-3xl font-bold text-gray-900">Custom</p>
              <p className="text-sm text-gray-500 mt-1">/ tailored</p>
              <ul className="mt-6 space-y-2 flex-1">
                {['Everything in Professional', 'Multi-office coordination', 'Dedicated account manager', 'Custom API access', 'SSO & advanced security'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">\u2713</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className="mt-8 inline-flex items-center justify-center h-11 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </motion.div>
          <p className="text-sm text-center text-gray-500 mt-6">
            All plans include a free onboarding checklist and guided workspace setup.
          </p>
        </Container>
      </section>

      {/* FINAL CTA */}
      <section className="w-full bg-gray-900 text-white py-24">
        <Container>
          <motion.div className="text-center" {...SECTION_REVEAL}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
              Your firm\u2019s operations deserve a system built for the work you do.
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-2xl mx-auto leading-relaxed">
              Join the firms already running on Docketra. Create your free workspace in minutes \u2014 no credit card, no setup complexity, no lock-in.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Create your free workspace \u2192
              </Link>
              <Link
                to="/#features"
                className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-gray-600 text-white text-sm hover:border-gray-400 transition-colors"
              >
                See all features
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-6">
              \u2713 Free during Early Access \u00b7 \u2713 No credit card required \u00b7 \u2713 Workspace ready in minutes
            </p>
          </motion.div>
        </Container>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Link to="/" className="font-semibold text-gray-900">Docketra</Link>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
              <button type="button" onClick={() => handleSectionNavigation('features')} className="hover:text-gray-900">
                Features
              </button>
              <button type="button" onClick={() => handleSectionNavigation('pricing')} className="hover:text-gray-900">
                Pricing
              </button>
              <Link to="/security" className="hover:text-gray-900">Security</Link>
              <Link to="/about" className="hover:text-gray-900">About</Link>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mt-8 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-3">Product</p>
              <ul className="space-y-2 text-gray-500">
                <li><button type="button" onClick={() => handleSectionNavigation('features')} className="hover:text-gray-900">Features</button></li>
                <li><button type="button" onClick={() => handleSectionNavigation('pricing')} className="hover:text-gray-900">Pricing</button></li>
                <li><span className="text-gray-400">Changelog</span></li>
                <li><Link to="/security" className="hover:text-gray-900">Security</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-3">Company</p>
              <ul className="space-y-2 text-gray-500">
                <li><Link to="/about" className="hover:text-gray-900">About</Link></li>
                <li><Link to="/contact" className="hover:text-gray-900">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-3">Legal</p>
              <ul className="space-y-2 text-gray-500">
                <li><Link to="/privacy" className="hover:text-gray-900">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-gray-900">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">\u00a9 2026 Docketra. All rights reserved.</p>
            <Link to="/signup" className="text-sm font-medium text-gray-900 hover:underline">
              Create your workspace \u2192
            </Link>
          </div>
        </Container>
      </footer>

    </div>
  );
};
