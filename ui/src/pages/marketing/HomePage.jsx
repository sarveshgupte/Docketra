import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Container from '../../components/layout/Container';

const CONTACT_EMAIL = 'sarveshgupte@gmail.com';

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
  viewport: { once: true, amount: 0.15 },
};

const FLOW_STEPS = [
  {
    id: 'CMS',
    title: 'Capture demand with CMS',
    body: 'Publish landing pages and forms, embed forms on your existing website, or accept leads through API intake.',
    points: ['Landing pages + forms', 'Embedded website forms', 'Public + API intake'],
    tone: 'from-violet-50 to-violet-100 border-violet-200',
  },
  {
    id: 'CRM',
    title: 'Manage pipeline with CRM',
    body: 'Qualify leads, assign ownership, track follow-ups, and keep relationship context visible to your team.',
    points: ['Lead pipeline visibility', 'Owner assignment', 'Follow-up + conversion tracking'],
    tone: 'from-blue-50 to-blue-100 border-blue-200',
  },
  {
    id: 'TASKS',
    title: 'Execute in Tasks',
    body: 'Move qualified work into dockets and task queues with routing, QC checks, and an audit history from start to finish.',
    points: ['Dockets + internal tasks', 'Workbaskets, routing, QC', 'Execution dashboards + audit trail'],
    tone: 'from-emerald-50 to-emerald-100 border-emerald-200',
  },
];

const FEATURE_GROUPS = [
  {
    title: 'CMS',
    subtitle: 'Get inbound demand into one structured system.',
    items: ['Public forms', 'Embedded website forms', 'Landing pages', 'API intake', 'Lead capture'],
  },
  {
    title: 'CRM',
    subtitle: 'Convert leads with clear ownership and follow-up discipline.',
    items: ['Lead pipeline', 'Owner assignment', 'Follow-up tracking', 'Notes and activity trail', 'Conversion tracking'],
  },
  {
    title: 'Tasks',
    subtitle: 'Execute client and internal work with consistent handoffs.',
    items: ['Dockets', 'Internal tasks', 'Workbaskets', 'QC flow', 'Routing and audit history'],
  },
  {
    title: 'Platform Ops',
    subtitle: 'Designed for firm operations and privacy-first scaling.',
    items: ['Module-based workflow', 'Client + internal work support', 'Reporting visibility', 'BYOS direction', 'BYOAI direction'],
  },
];

const OUTCOMES = [
  'Reduce operational confusion across teams',
  'Capture more leads with cleaner intake',
  'Stop losing handoff context between functions',
  'Track follow-ups and conversions more reliably',
  'Route work faster with better ownership clarity',
  'Improve cross-team visibility with one operating view',
];

const FAQS = [
  {
    q: 'What is Docketra?',
    a: 'Docketra is a connected operating system for firms to capture leads (CMS), manage relationships (CRM), and execute work (Tasks).',
  },
  {
    q: 'Is Docketra free right now?',
    a: 'Yes. Early access is currently free while we are in testing. There is no billing or subscription setup yet.',
  },
  {
    q: 'Who is Docketra for?',
    a: 'It is built for CA firms, CS firms, law firms, compliance teams, advisory teams, and operations-heavy service businesses.',
  },
  {
    q: 'Can I use Docketra with my existing website?',
    a: 'Yes. You can embed intake forms on your existing website or push leads through API intake.',
  },
  {
    q: 'Can Docketra handle internal tasks too?',
    a: 'Yes. In addition to client work, teams can run internal tasks and workbaskets in the same system.',
  },
  {
    q: 'How do leads move into work?',
    a: 'Leads are captured through CMS, qualified in CRM, and then converted into execution flows in Tasks using dockets and routing.',
  },
  {
    q: 'How do I contact you?',
    a: `Email us at ${CONTACT_EMAIL} for early access, product questions, or feedback.`,
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
      <section className="w-full bg-gradient-to-b from-white via-slate-50 to-white py-16 md:py-24">
        <Container className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8 lg:gap-12 items-start">
          <motion.div className="md:col-span-7" {...SECTION_REVEAL}>
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">For firms and operations teams</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Get clients, manage them, and execute work in one connected system.
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">
              Docketra combines <strong>CMS + CRM + Tasks</strong> so your team can capture leads, run follow-ups, and deliver work with clear handoffs from intake to execution.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-all"
              >
                Try Docketra
              </Link>
              <button
                type="button"
                onClick={() => handleSectionNavigation('how-it-works')}
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Explore how it works
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-500">Early access is currently free · No billing setup yet · Help shape the product</p>
          </motion.div>

          <motion.div
            className="md:col-span-5 rounded-2xl border border-gray-200 bg-white shadow-lg p-5"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Operating flow</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">CMS → CRM → Tasks</h3>
            <div className="mt-5 space-y-3">
              {FLOW_STEPS.map((step, index) => (
                <motion.div
                  key={step.id}
                  className={`rounded-xl border bg-gradient-to-br ${step.tone} p-4`}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.08 }}
                  viewport={{ once: true }}
                >
                  <p className="text-xs font-semibold tracking-wide text-gray-600">{step.id}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-2 text-sm text-gray-700">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </Container>
      </section>

      <section className="w-full bg-gray-900 text-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">The problem</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">
              Lead sources are fragmented, client context gets scattered, and work handoffs break.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-6 mt-12" {...SECTION_REVEAL}>
            {[
              {
                title: 'Leads come from everywhere',
                body: 'Website forms, referrals, email, and ad campaigns create intake chaos when everything lands in separate tools.',
              },
              {
                title: 'Client context is hard to track',
                body: 'Follow-ups, ownership, and stage progression are often unclear, so conversion opportunities are missed.',
              },
              {
                title: 'Execution gets disconnected',
                body: 'Internal tasks and client work run in different places, so teams lose handoff context from inquiry to delivery.',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-3">{card.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="solution" className="w-full bg-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How Docketra works</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">
              One operating model for the full journey: CMS → CRM → Tasks.
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">
              Capture demand, manage relationships, and execute delivery with one connected flow so nothing gets lost between teams.
            </p>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-6 mt-12" {...SECTION_REVEAL}>
            {FLOW_STEPS.map((step) => (
              <div key={step.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
                <div className="text-xs inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1 font-semibold text-gray-700">{step.id}</div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{step.body}</p>
                <ul className="mt-4 space-y-2">
                  {step.points.map((point) => (
                    <li key={point} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="features" className="w-full bg-gray-50 py-20 md:py-24 border-y border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Features</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">Everything your team needs to run operations cleanly.</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {FEATURE_GROUPS.map((group, index) => (
              <motion.div
                key={group.title}
                className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.08, 0.28) }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl font-semibold text-gray-900">{group.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{group.subtitle}</p>
                <ul className="mt-5 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      <section className="w-full bg-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Why Docketra helps</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              Better operational outcomes, not just more software.
            </h2>
          </motion.div>
          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10" {...SECTION_REVEAL}>
            {OUTCOMES.map((outcome) => (
              <div key={outcome} className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
                {outcome}
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section className="w-full bg-gray-900 text-white py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Product visual walkthrough</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">
              See how operations look in practice.
            </h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-2 gap-6 mt-12" {...SECTION_REVEAL}>
            {[
              {
                title: 'Dashboard view',
                body: 'Track intake volume, active pipelines, and execution health from one summary layer.',
              },
              {
                title: 'Lead pipeline',
                body: 'Monitor stage movement, owner accountability, and conversion progress without switching tools.',
              },
              {
                title: 'Intake flow',
                body: 'Capture structured submissions from hosted pages, embedded forms, or API channels.',
              },
              {
                title: 'Task execution',
                body: 'Run docket queues with workbasket routing, QC checkpoints, and complete audit history.',
              },
            ].map((card, index) => (
              <motion.div
                key={card.title}
                className="rounded-2xl border border-gray-700 bg-gray-800 p-6"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                viewport={{ once: true }}
              >
                <div className="h-32 rounded-xl border border-gray-600 bg-gradient-to-br from-gray-700 to-gray-800 mb-4 flex items-center justify-center text-gray-400 text-xs uppercase tracking-widest">
                  Mock UI panel
                </div>
                <h3 className="text-base font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{card.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="use-cases" className="w-full bg-white py-20 md:py-24 border-y border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Who it is for</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">Built for firms and operations-heavy service teams.</h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12" {...SECTION_REVEAL}>
            {['CA firms', 'CS firms', 'Law firms', 'Compliance and advisory teams', 'Operations-heavy service businesses', 'Growing multi-team practices'].map((item) => (
              <div key={item} className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-700">{item}</div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="how-it-works" className="w-full bg-gray-50 py-20 md:py-24">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How teams can start</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-4xl">Start small, then scale your workflow.</h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-4 gap-4 mt-12" {...SECTION_REVEAL}>
            {[
              'Capture leads through CMS',
              'Qualify and assign in CRM',
              'Start delivery in Tasks with dockets',
              'Run internal work in the same system',
            ].map((step, idx) => (
              <div key={step} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500">STEP {idx + 1}</p>
                <p className="mt-2 text-sm font-medium text-gray-800">{step}</p>
              </div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="pricing" className="w-full bg-white py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Early access</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">Free while in testing. Honest and simple.</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl">We do not have billing or subscription setup yet. Early users can explore the product and help shape what comes next.</p>
          </motion.div>
          <motion.div className="mt-10 max-w-xl" {...SECTION_REVEAL}>
            <div className="rounded-2xl border-2 border-blue-500 bg-white p-8 shadow-lg">
              <span className="inline-flex rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1">Current offer</span>
              <h3 className="mt-4 text-2xl font-semibold text-gray-900">Early Access</h3>
              <p className="mt-1 text-4xl font-bold text-gray-900">Free</p>
              <p className="mt-4 text-sm text-gray-600">No billing setup yet. No subscription checkout. Just request access and start exploring.</p>
              <ul className="mt-6 space-y-2 text-sm text-gray-700">
                <li>✓ Free while in testing</li>
                <li>✓ Product walkthrough and onboarding support</li>
                <li>✓ Direct feedback loop with the product team</li>
              </ul>
              <Link to="/signup" className="mt-7 inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors">
                Request early access
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>

      <section className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <motion.div {...SECTION_REVEAL}>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">FAQ</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl">Common questions before you start.</h2>
          </motion.div>
          <motion.div className="mt-10 space-y-4" {...SECTION_REVEAL}>
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-xl border border-gray-200 bg-white p-5">
                <summary className="cursor-pointer list-none font-medium text-gray-900 flex items-center justify-between">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </motion.div>
        </Container>
      </section>

      <section className="w-full bg-gray-900 text-white py-24">
        <Container>
          <motion.div className="text-center" {...SECTION_REVEAL}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
              Start exploring Docketra and improve operational clarity.
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-2xl mx-auto leading-relaxed">
              If your team wants a cleaner handoff from lead capture to execution, Docketra is ready for early access testing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Try Docketra
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-gray-600 text-white text-sm hover:border-gray-400 transition-colors"
              >
                Request early access
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-6">Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-white">{CONTACT_EMAIL}</a></p>
          </motion.div>
        </Container>
      </section>

      <footer className="bg-white border-t border-gray-100 py-12">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Link to="/" className="font-semibold text-gray-900">Docketra</Link>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
              <button type="button" onClick={() => handleSectionNavigation('features')} className="hover:text-gray-900">Features</button>
              <button type="button" onClick={() => handleSectionNavigation('pricing')} className="hover:text-gray-900">Early Access</button>
              <Link to="/security" className="hover:text-gray-900">Security</Link>
              <Link to="/about" className="hover:text-gray-900">About</Link>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© 2026 Docketra. All rights reserved.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-medium text-gray-900 hover:underline">{CONTACT_EMAIL}</a>
          </div>
        </Container>
      </footer>
    </div>
  );
};
